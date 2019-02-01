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
    const schema = mergedContent && mergedContent.schema
    if (!schema) return
    
    const skvs = getProperties(schema)
    return h('fieldset.tre-property-sheet', {
      disabled: ctx.disabled == true
    }, skvs.map(skv => renderProperty(skv, [])))

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

      return computed(contentObs, content => {
        let value = pointer.find(mergedContent, fullPath)
        const cvalue = pointer.find(content, fullPath)
        const isInherited = cvalue == undefined
        const save = saveFunc(schema, skv, path, value, contentObs)

        if ('number integer string'.split(' ').includes(skv.value.type)) {
          return [
            h('div.property', {
              classList: isInherited ?  ['inherited'] : [],
              attributes: {
                'data-schema-type': skv.value.type,
                'data-schema-name': skv.key,
                'data-schema-path': pointer.encode(fullPath)
              }
            }, [
              h('span', title),
              h('input', {
                type: skv.value['input-type'] || (skv.value.type == 'number' ? 'number' : 'text'),
                value,
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
        return []
      })
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

function saveFunc(schema, skv, path, value, contentObs) {
  return function(v) {
    if (v == value) return
    const coerce = {
      number: Number,
      integer: Number,
      boolean: Boolean
    }[skv.value.type] || (x => x)
    value = coerce(v)
    // avoids destroying event.target in event handler
    setTimeout( ()=> {
      const c = contentObs()
      const parent = pointer.find(c, path) || createContainer(schema, c, path)
      parent[skv.key] = value
      contentObs.set(c)
    }, 0)
  }
}
