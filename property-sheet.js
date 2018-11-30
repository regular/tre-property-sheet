const h = require('mutant/html-element')
const getProperties = require('./get-properties')

module.exports = function(opts) {
  opts = opts || {}

  return function renderPropertySheet(schema, content, ctx) {
    ctx = ctx || {}
    const kvs = getProperties(schema)
    return h('fieldset.tre-propertiy-sheet', {
      disabled: ctx.disabled == true
    }, getProperties(schema).map(kv => renderProperty(kv, content)))
  }

  function renderProperty({key, value}, content) {
    content = content || {}
    const title = value.title || key
    if (value.type == 'object') {
      return h('details', {open: true}, [
        h('summary', title),
        getProperties(value).map(kv => renderProperty(kv, content[key]))
      ])
    }
    if ('number integer string'.split(' ').includes(value.type)) {
      return [
        h('div', {
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
