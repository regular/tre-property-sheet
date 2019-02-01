const h = require('mutant/html-element')
const Value = require('mutant/value')
const computed = require('mutant/computed')
const getProperties = require('get-properties-from-schema')
const pointer = require('json8-pointer')
const comparer = require('deep-equal')

module.exports = function(opts) {
  opts = opts || {}

  return function renderPropertySheet(kv, ctx) {
    ctx = ctx || {}
    const mergedContent = kv && kv.value.content
    const contentObs = ctx.contentObs || Value({})
    const previewObs = ctx.previewObs || Value(kv)
    const schemaObs = computed(previewObs, kv => kv && kv.value.content.schema)
    
    return computed(schemaObs, schema => {
      if (!schema) return []
      const skvs = getProperties(schema)
      return h('fieldset.tre-property-sheet', {
        disabled: ctx.disabled
      }, skvs.map(skv => renderProperty(skv, [])))
    })

    function renderProperty(skv, path) {
      const fullPath = path.concat([skv.key])
      const title = skv.value.title || skv.key
      if (skv.value.type == 'object') {
        return h('details', {open: true}, [
          h('summary', title),
          h('div.properties', [
            getProperties(skv.value).map(skv => renderProperty(skv, fullPath))
          ])
        ])
      }

      // pvalueObs might originate from a prototype
      const pvalueObs = ctx.previewObs ?
        computed(ctx.previewObs, kv => kv && pointer.find(kv.value.content, fullPath)) :
        Value(pointer.find(mergedContent, fullPath))
      // cvalueObs originates from this message only (own content)
      const cvalueObs = computed(ctx.contentObs, content => content && pointer.find(content, fullPath))

      const save = saveFunc(schemaObs, skv, path, contentObs, pvalueObs)

      const classList = computed([pvalueObs, cvalueObs], (pvalue, cvalue) => {
        const isInherited = pvalue !== undefined && cvalue == undefined
        //console.log('XXX', mergedContent, fullPath, cvalue)
        const isNew = !isInherited && cvalue !== pointer.find(mergedContent, fullPath)
        const cls = [...(isNew ? ['new'] : []), ...(isInherited ? ['inherited'] : [])]
        return cls
      })

      if (!'number integer string'.split(' ').includes(skv.value.type)) {
        return []
      }
      return [
        h('div.property', {
          classList,
          attributes: {
            'data-schema-type': skv.value.type,
            'data-schema-name': skv.key,
            'data-schema-path': pointer.encode(fullPath)
          }
        }, [
          h('span', title),
          h('input', {
            type: skv.value['input-type'] || (skv.value.type == 'number' ? 'number' : 'text'),
            value: pvalueObs,
            'ev-blur': e => {
              save(e.target.value)
            },
            'ev-change': e => {
              save(e.target.value)
            },
            'ev-keydown': e => {
              if (e.key == 'Escape') {
                e.blur()
                e.preventDefault()
              }
              if (e.key == 'Enter') {
                save(e.target.value)
                e.preventDefault()
              }
            }
          })
        ])
      ]
    }
  }
}

function getTypeAtPath(schema, path) {
  if (!path.length) return schema.type
  const props = getProperties(schema)
  if (ptops.type !== 'array' && props.type !== 'object') throw new Error('Inavlid schema path:' + path)
  path = path.slice()
  const key = path.shift()
  return getTypeAtPath(proprs[key].value, path)
}

function matchesSchemaType(o, t) {
  if(Array.isArray(o)) {
    if (t == 'array') return true
    return false
  } 
  return t == 'object' && typeof o == 'object'
}

function throwIfNotMatching(o, t) {
  if (!matchesSchemaType(o, t)) {
    console.error('schema.type', t)
    console.error('object', o)
    throw new Error('Object does not match schema type')
  }
}

function createContainer(schema, obj, path) {
  throwIfNotMatching(obj, schema.type)
  if (!path.length) return obj
  path = path.slice()
  const key = path.shift()
  const props = getProperties(schema)
  const prop = props.find( p => p.key == key)
  if (!prop) throw new Error('Schema property not found: ' + key)
  if (obj[key]) {
    throwIfNotMatching(obj[key], prop.value.type)
    return createContainer(prop.value, obj[key], path)
  }
  const type = prop.value.type
  const newObj = type == 'object' ? {} : type == 'array' ? [] : undefined
  if (!newObj) throw new Error('Unable to create container. Wrong schema type: ' + type)
  obj[key] = newObj
  return createContainer(prop.value, obj[key], path)
}

function saveFunc(schemaObs, skv, path, contentObs, pvalueObs) {
  return function(v) {
    const coerce = {
      number: Number,
      integer: Number,
      boolean: Boolean
    }[skv.value.type] || (x => x)
    const newValue = coerce(v)
    const oldValue = pvalueObs()
    if (newValue == oldValue) return

    // avoids destroying event.target in event handler
    setTimeout( ()=> {
      const c = contentObs()
      const parent = pointer.find(c, path) || createContainer(schemaObs(), c, path)
      parent[skv.key] = newValue
      contentObs.set(c)
    }, 0)
  }
}
