const objPath = require('object-path')

module.exports = function getProperties(schema) {
  const props = schema.properties || {}
  return Object.keys(props).map( k => processProperty(k, props[k]))

  function processProperty(key, value) {
    value = resolveRefs(value)
    return {key, value}
  }

  function resolveRefs(value) {
    const $ref = value.$ref
    if (!$ref) return value
    if (!$ref.startsWith('#/')) throw new Error('External $ref are Unsupported: ' + $ref)
    const path = $ref.slice(2).split('/')
    const target = objPath.get(schema, path)
    value = Object.assign({}, value)
    delete value.$ref
    value = Object.assign(value, target)
    return resolveRefs(value)
  }
}


