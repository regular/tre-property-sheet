const {client} = require('tre-client')
const h = require('mutant/html-element')
const Value = require('mutant/value')
const computed = require('mutant/computed')
const setStyle = require('module-styles')('tre-schema-demo')
const {makePane, makeDivider, makeSplitPane} = require('tre-split-pane')
const WatchMerged = require('tre-prototypes')
const Finder = require('tre-finder')
const Editor = require('tre-json-editor')
const PropertySheet = require('.')
const validate = require('./validate')
require('brace/theme/solarized_dark')

setStyle(`
  body, html, .tre-schema-demo {
    height: 100%;
    margin: 0;
    padding: 0;
  }
  body {
    --tre-selection-color: green;
    --tre-secondary-selection-color: yellow;
    font-family: sans-serif;
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
  .tre-finder summary:focus {
    outline: 1px solid rgba(255,255,255,0.1);
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

  .tre-property-sheet {
    background: #4a4a4b;
    color: #b6b6b6;
  }

  .tre-property-sheet summary {
    font-weight: bold;
    text-shadow: 0 0 4px black;
    margin-top: .3em;
    padding-top: .4em;
    background: #555454;
    border-top: 1px solid #807d7d;
    margin-bottom: .1em;
  }
  .tre-property-sheet input {
    background: #D0D052;
    border: none;
    margin-left: .5em;
  }
  .tre-property-sheet .inherited input {
    background: #656464;
  }
  .tre-property-sheet details > div {
    margin-left: 1em;
  }
  .tre-property-sheet [data-schema-type="number"] input {
    width: 4em;
  }
  .tre-property-sheet .properties {
    display: grid;
    grid-template-columns: repeat(auto-fill, 5em);
  }
`)

client( (err, ssb, config) => {
  if (err) return console.error(err)
  const watchMerged = WatchMerged(ssb)
  const renderPropertySheet = PropertySheet()

  const contentObs = Value()
  const syntaxErrorObs = Value()
  const primarySelection = Value()
  const editing_kv = computed(contentObs, c => {
    if (!c) return null
    return {
      key: 'fake key',
      value: {
        content: c
      }
    }
  })
  const merged_kv = watchMerged(editing_kv)
  const schema = computed(merged_kv, kv => {
    return kv && kv.value.content.schema
  })
  const errors = computed([schema, merged_kv], (s, kv) => {
    const c = content(kv)
    if (!s || !c) return ['no Schema']
    return validate(s, c)
  }) 
    
  const renderFinder = Finder(ssb, {
    resolve_prototypes: true, // this is the default
    primarySelection,
    skipFirstLevel: true,
    details: (kv, ctx) => {
      return kv && kv.meta && kv.meta["prototype-chain"] ? h('i', '(has proto)') : []
    },
    factory: {
      menu: ()=> [{label: 'Box', type: 'object'}],
      make: type => type == 'object' && {
        type: 'transform',
        prototype: config.tre.prototypes.transform
      }
    }
  })

  const renderEditor = Editor(null, {
    ace: {
      theme: 'ace/theme/solarized_dark',
      tabSize: 2,
      useSoftTabs: true
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
            computed(primarySelection, kv => kv ? renderEditor(kv, {contentObs, syntaxErrorObs}) : []),
            computed(errors, errs => {
              return h('.schema-errors', errs ?
                errs.map( e => renderError(e))
                : [h('i', 'Content is valid')]
              )
            })
          ]),
          makeDivider(),
          makePane('30%', [
            h('h1', 'Schema'),
            h('pre.schema', computed(schema, s => s && JSON.stringify(s, null, 2)))
          ]),
          makeDivider(),
          makePane('30%', [
            h('h1', 'Property Sheet'), computed([schema, merged_kv, syntaxErrorObs], (schema, kv, syntaxError) => {
              const c = content(kv)
              if (!c || !schema) return []
              return renderPropertySheet(kv, {
                disabled: !!syntaxError,
                contentObs
              })
            })
          ])
        ])
      ])
    ])
  )
})

// -- utils

function content(kv) {
  return kv && kv.value && kv.value.content 
}

function proto(kv) {
  const c = content(kv)
  return c && c.prototype
}

function renderError(err) {
  return Object.keys(err).map(k => h(`span.${k}`, err[k]))
}

