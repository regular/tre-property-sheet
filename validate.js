const Ajv = require('ajv')

module.exports = function(schema, content) { 
  const ajv = new Ajv()
  const ok = ajv.validate(schema, content)
  if (!ok) return ajv.errors
  return null
}

