const h = require('mutant/html-element')
const Value = require('mutant/value')
const getProperties = require('./get-properties')
const pointer = require('json8-pointer')

module.exports = function(opts) {
  opts = opts || {}

  return function renderPropertySheet(kv, ctx) {
    ctx = ctx || {}
    const contentObs = ctx.contentObs || Value({})
    const mergedContent = kv.value.content
    const schema = mergedContent.schema

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
          h('div.properties', 
            getProperties(skv.value).map(skv => renderProperty(skv, fullPath))
          )
        ])
      }
      let value = pointer.find(mergedContent, fullPath)
      const isInherited = value !== pointer.find(contentObs(), fullPath)
      
      function save(v) {
        const coerce = {
          number: Number,
          integer: Number,
          boolean: Boolean
        }[skv.value.type] || (x => x)
        v = coerce(v)
        const c = contentObs()
        const parent = pointer.find(c, path)
        if (!parent) return console.error('Unable to set', fullPath)
        parent[skv.key] = v
        value = v
        contentObs.set(c)
      }
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
    }
  }
}
