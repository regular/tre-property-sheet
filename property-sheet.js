const h = require('mutant/html-element')
const getProperties = require('./get-properties')

module.exports = function(opts) {
  opts = opts || {}

  return function renderPropertySheet(schema, content, ctx) {
    ctx = ctx || {}
    const kvs = getProperties(schema)
    return h('fieldset.tre-property-sheet', {
      disabled: ctx.disabled == true
    }, getProperties(schema).map(kv => renderProperty(kv, content)))
  }

  function renderProperty({key, value}, content) {
    content = content || {}
    const title = value.title || key
    if (value.type == 'object') {
      return h('details', {open: true}, [
        h('summary', title),
        h('div.properties', 
          getProperties(value).map(kv => renderProperty(kv, content[key]))
        )
      ])
    }
    if ('number integer string'.split(' ').includes(value.type)) {
      return [
        h('div.property', {
          attributes: {
            'data-schema-type': value.type,
            'data-schema-name': key
          }
        }, [
          h('span', title),
          h('input', {
            type: value['input-type'] || (value.type == 'number' ? 'number' : 'text'),
            value: content[key]
          })
        ])
      ]
    }
    return []
  }
}
