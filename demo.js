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
const Shell = require('tre-editor-shell')
const validate = require('./validate')
require('brace/theme/solarized_dark')

styles()

client( (err, ssb, config) => {
  if (err) return console.error(err)
  const watchMerged = WatchMerged(ssb)
  const renderPropertySheet = PropertySheet()

  const contentObs = Value()
  const syntaxErrorObs = Value()
  const primarySelection = Value()

  const previewObs = getPreviewObs(contentObs)
  const schema = computed(previewObs, kv => {
    return kv && kv.value.content.schema
  })
  // TODO: move to EditorShell
  const errors = computed([schema, previewObs], (s, kv) => {
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
      menu: ()=> [{label: 'Box', type: 'box'}],
      make: type => type == 'box' && {
        type: 'box',
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

  const renderShell = Shell(ssb, {
    save: (kv, cb) => {
      ssb.publish(kv.value.content, cb)
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
            //h('span', computed(primarySelection, kv => `based on ${kv && kv.key}`)),
            computed(ignoreRevision(primarySelection), kv => kv ?  renderShell(kv, {
              renderEditor,
              contentObs,
              syntaxErrorObs,
              previewObs
            }) : []),
            // TODO: move to editor shell
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
            h('h1', 'Property Sheet'), computed(ignoreRevision(primarySelection), kv => {
              return renderPropertySheet(kv, {
                disabled: computed(syntaxErrorObs, e => !!e),
                contentObs,
                previewObs
              })
            })
          ])
        ])
      ])
    ])
  )

  function getPreviewObs(contentObs) {
    const editing_kv = computed(contentObs, content => {
      if (!content) return null
      return {
        key: 'draft',
        value: {
          content
        }
      }
    })
    return watchMerged(editing_kv)
  }
})

// -- utils

function unmergeKv(kv) {
  // if the message has prototypes and they were merged into this message value,
  // return the unmerged/original value
  return kv.meta && kv.meta['prototype-chain'] && kv.meta['prototype-chain'][0] || kv
}

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

function styles() {
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
    .tre-property-sheet .new input {
      background: white;
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

    .tre-editor-shell {
      width: 100%;
    }
    .tre-editor-shell .operations li span {
      margin-right: .5em;
    }
    .tre-editor-shell .new-revision {
      background: #B9A249;
      padding: 1em;
      margin-bottom: 1em;
    }
    .tre-editor-shell .operations span.path {
      font-family: monospace;
    }
    .tre-editor-shell .operations span.value.string:before {
      content: "\\"";
    }
    .tre-editor-shell .operations span.value.string:after {
      content: "\\"";
    }
  `)
}

function revisionRoot(kv) {
  return kv && kv.value.content && kv.value.content.revisionRoot || kv && kv.key
}

function ignoreRevision(primarySelection) {
  let current_kv
  return computed(primarySelection, kv => {
    if (current_kv && revisionRoot(current_kv) == revisionRoot(kv)) {
      return computed.NO_CHANGE
    }
    current_kv = kv
    return kv
  })
}


