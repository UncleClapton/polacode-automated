/* global acquireVsCodeApi, domtoimage */

(function CodeCaptureScript () {
  const vscode = acquireVsCodeApi()

  let target = 'container'
  let scale = 2

  const snippetNode = document.getElementById('snippet')
  const snippetTitleNode = document.getElementById('snippet-title')
  const snippetCodeNode = document.getElementById('snippet-code')
  const snippetContainerNode = document.getElementById('snippet-container')


  let state = {
    renderTitle: false,
    windowTitle: null,
    innerHTML: null,
  }

  const render = () => {
    snippetTitleNode.innerHTML = state.renderTitle && state.windowTitle ? `<span>${state.windowTitle}</span>` : ''

    if (state.innerHTML) {
      snippetCodeNode.innerHTML = state.innerHTML
    }
  }

  const setState = (partialState = {}) => {
    state = {
      ...state,
      ...partialState,
    }

    vscode.setState(state)

    render()
  }

  const getMinIndent = (code) => {
    const arr = code.split('\n')

    let minIndentCount = Number.MAX_VALUE

    arr.forEach((line) => {
      const wsCount = line.search(/\S/u)
      if (wsCount !== -1) {
        if (wsCount < minIndentCount) {
          minIndentCount = wsCount
        }
      }
    })

    return minIndentCount
  }

  const stripHtmlIndent = (html, indent) => {
    if (indent === 0) {
      return html
    }

    const doc = new DOMParser().parseFromString(html, 'text/html')

    doc.querySelectorAll('div > div span:first-child').forEach((node) => {
      // eslint-disable-next-line no-param-reassign
      node.textContent = node.textContent.slice(indent)
    })

    return doc.body.innerHTML
  }

  const stripTextIndent = (code, indent) => {
    const lines = code.split(/\r?\n/gu)

    return lines.map(
      (line) => line.slice(indent)
    ).join('\n')
  }

  document.addEventListener('paste', (event) => {
    console.log('fuck me', event)
    const code = event.clipboardData.getData('text/plain')
    const indent = getMinIndent(code)

    let innerHTML = event.clipboardData.getData('text/html')
    if (innerHTML.length > 0) {
      innerHTML = stripHtmlIndent(innerHTML, indent)
    } else {
      innerHTML = stripTextIndent(code, indent)
    }

    setState({ innerHTML })
  })





  const serializeBlob = (blob) => {
    return new Promise((resolve) => {
      const fileReader = new FileReader()

      fileReader.onload = () => {
        const bytes = new Uint8Array(fileReader.result)
        resolve(Array.from(bytes).join(','))
      }

      fileReader.readAsArrayBuffer(blob)
    })
  }

  const shoot = async (config) => {
    snippetNode.style.resize = 'none'

    const blob = await domtoimage.toBlob(snippetContainerNode, config)

    snippetNode.style.resize = null

    const serializedBlob = await serializeBlob(blob)

    vscode.postMessage({
      type: 'shoot',
      data: {
        serializedBlob,
      },
    })
  }

  const shootAll = () => {
    shoot({
      width: snippetContainerNode.offsetWidth * scale,
      height: snippetContainerNode.offsetHeight * scale,
      style: {
        transform: scale > 1 ? `scale(${scale})` : null,
        'transform-origin': 'center',
      },
    })
  }

  const shootSnippet = () => {
    shoot({
      width: snippetNode.offsetWidth * scale,
      height: snippetNode.offsetHeight * scale,
      style: {
        transform: scale > 1 ? `scale(${scale})` : null,
        'transform-origin': 'center',
        padding: 0,
        background: 'none',
      },
    })
  }

  snippetTitleNode.addEventListener('click', () => {
    setState({ renderTitle: !state.renderTitle })
  })

  snippetCodeNode.addEventListener('dblclick', () => {
    snippetNode.style.width = null
  })

  document.getElementById('save').addEventListener('click', () => {
    if (target === 'container') {
      shootAll()
    } else {
      shootSnippet()
    }
  })

  window.addEventListener('message', (event) => {
    console.log('event', event)
    if (event) {
      switch (event.data.type) {
        case 'updateSnippet':
          state.windowTitle = event.data.windowTitle
          document.execCommand('paste')
          break

        case 'updateSettings':
          target = event.data.target
          scale = event.data.scale
          snippetContainerNode.style.background = event.data.background || 'transparent'
          snippetNode.style.margin = target === 'container' ? `${event.data.padding}px` : null
          snippetNode.style.boxShadow = target === 'container' ? event.data.shadow : 'none'
          snippetCodeNode.style.fontVariantLigatures = event.data.ligature ? 'normal' : 'none'
          setState({ renderTitle: event.data.renderTitle })
          break

        default:
          break
      }
    }
  })

  snippetContainerNode.style.opacity = '1'

  const oldState = vscode.getState()
  if (oldState) {
    setState(oldState)
  }
}())
