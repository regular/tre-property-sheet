const {client} = require('tre-client')
const Finder = require('tre-finder')
const Editor = require('tre-json-editor')
const h = require('mutant/html-element')
const Value = require('mutant/value')
const computed = require('mutant/computed')
const setStyle = require('module-styles')('tre-schema-demo')
const {makePane, makeDivider, makeSplitPane} = require('tre-split-pane')
const WatchMerged = require('tre-prototypes')
require('brace/theme/solarized_dark')

const Ajv = require('ajv')
const getProperties = require('.')

function renderError(err) {
  return Object.keys(err).map(k => h(`span.${k}`, err[k]))
}

setStyle(`
  body, html, .tre-schema-demo {
    height: 100%;
    margin: 0;
    padding: 0;
  }
  body {
    --tre-selection-color: green;
    --tre-secondary-selection-color: yellow;
    font-family: sans;
  }
  h1 {
    font-size: 18px;
  }
  .pane {
    background: #eee;
  }
  .tre-finder .summary select {
    font-size: 9pt;
    background: transparent;
    border: none;
    width: 50px;
  }
  .tre-finder summary {
    white-space: nowrap;
  }

  .schema-errors span {
    padding: .1em .1em;
  }

  .schema-errors .schemaPath {
    display: none;
  }

  .schema-errors .keyword {
    color: red;
    margin-right: 2em;
  }
`)

client( (err, ssb, config) => {
  if (err) return console.error(err)

  const contentObs = Value()
  const watchMerged = WatchMerged(ssb)
  const primarySelection = Value()
  /*
  const merged_kv = computed(primarySelection, kv => {
    const c = content(kv)
    if (!c) return
    return watchMerged(c.revisionRoot || kv.key)
  })
  */
  const content_kv = computed(contentObs, c => {
    if (!c) return null
    return {
      key: 'fake key',
      value: {
        content: c
      }
    }
  })
  const merged_content = watchMerged(content_kv)
  const schema = computed(merged_content, kv => {
    const s = kv && kv.value.content.schema
    function pre() {
      console.log('pre', arguments)
    }
    function post() {}
    if (s) {
      schemaWalk(s, pre, post)
    }
    return s
  })
  const errors = computed([schema, merged_content], (s, kv) => { 
    const c = content(kv)
    if (!s || !c) return ['no Schema']
    const ajv = new Ajv()
    const ok = ajv.validate(s, c)
    if (!ok) return ajv.errors
    return ['Validates!']
  })
  const renderFinder = Finder(ssb, {
    resolve_prototypes: false,
    primarySelection,
    skipFirstLevel: true,
    details: (kv, ctx) => {
      return kv && kv.meta && kv.meta["prototype-chain"] ? h('i', '(has proto)') : []
    },
    factory: {
      menu: ()=> [{label: 'Object', type: 'object'}],
      make: type => type == 'object' && {
        type: 'object',
        text: "Hi, I'm Elfo!",
        prototype: config.tre.prototypes.transform
      }
    }
  })

  const renderEditor = Editor(null, {
    ace: {
      theme: 'ace/theme/solarized_dark',
      tabSize: 2,
      useSoftTabs: true
    },
    save: (kv, cb) => {
      const content = kv.value.content
      content.revisionBranch = kv.key
      content.revisionRoot = content.revisionRoot || kv.key
      console.log('new content', content)
      ssb.publish(content, cb)
    }
  })

  document.body.appendChild(
    h('.tre-schema-demo', [
      makeSplitPane({horiz: false}, [
        makeSplitPane({horiz: true}, [
          makePane('25%', [
            h('h1', 'Finder'),
            renderFinder(config.tre.branches.root)
          ]),
          makeDivider(),
          makePane('', [
            h('h1', 'Editor'),
            h('span', computed(primarySelection, kv => `based on ${kv && kv.key}`)),
            computed(primarySelection, kv => kv ? renderEditor(kv, {contentObs}) : []),
            computed(errors, errs => {
              return h('.schema-errors', errs.map( e => renderError(e)))
            })
          ]),
          makeDivider(),
          makePane('30%', [
            h('h1', 'Schema'),
            h('pre.schema', computed(schema, s => s && JSON.stringify(s, null, 2)))
          ]),
          makeDivider(),
          makePane('30%', [
            h('h1', 'Property Tree'),
            h('.properties', computed(schema, s => s && getProperties(s).map(renderProperty)))
          ])
        ])
      ])
    ])
  )
})

// -- utils

function renderProperty({key, value}) {
  if (value.type == 'object') {
    return h('details', [
      h('summary', key),
      getProperties(value).map(renderProperty)
    ])
  }
  return h('div', key)
}

function content(kv) {
  return kv && kv.value && kv.value.content 
}

function proto(kv) {
  const c = content(kv)
  return c && c.prototype
}
