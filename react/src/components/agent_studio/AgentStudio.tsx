import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  addEdge,
  Edge,
  Node,
  OnConnect,
  NodeMouseHandler,
} from '@xyflow/react'
import debounce from 'lodash.debounce'

import '@xyflow/react/dist/style.css'
import AgentNode from './AgentNode'
import { Textarea } from '../ui/textarea'
import TopMenu from '../TopMenu'

const LOCAL_STORAGE_KEY = 'agent-studio-graph'

const defaultNodes = [
  {
    id: '1',
    type: 'agent',
    position: { x: 0, y: 0 },
    data: { label: '1' },
  },
  {
    id: '2',
    type: 'agent',
    position: { x: 100, y: 100 },
    data: { label: '2' },
  },
]
// const defaultEdges = [{ id: 'e1-2', source: '1', target: '2' }]
const defaultEdges: Edge[] = []

const loadInitialGraph = () => {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      return [parsed.nodes || defaultNodes, parsed.edges || defaultEdges]
    }
  } catch (e) {
    console.warn('Failed to load saved graph', e)
  }
  return [defaultNodes, defaultEdges]
}

export default function AgentStudio() {
  const [initialNodes, initialEdges] = loadInitialGraph()
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)

  const saveGraph = useRef(
    debounce((nodes, edges) => {
      console.log('Saving graph', nodes, edges)
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ nodes, edges }))
    }, 500)
  ).current

  useEffect(() => {
    saveGraph(nodes, edges)
  }, [nodes, edges, saveGraph])

  const onNodeClick: NodeMouseHandler<Node> = useCallback((_, node) => {
    console.log('onNodeClick', node)
    setSelectedNode(node)
  }, [])

  const onConnect: OnConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  )

  const nodeTypes = {
    agent: AgentNode,
  }

  return (
    <div>
      <TopMenu />
      <div style={{ width: '100vw', height: '100vh' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
        />
      </div>
      {/* Sidebar */}
      {selectedNode && (
        <>
          <div
            className="absolute right-0 top-0 left-0 bottom-0"
            onClick={() => setSelectedNode(null)}
          />
          <div
            className="absolute right-0 top-0 h-[100vh] w-96 bg-sidebar"
            style={{
              width: '25%',
              padding: '16px',
              boxSizing: 'border-box',
              overflowY: 'auto',
            }}
          >
            <input
              type="text"
              placeholder="Enter Agent Name"
              className="w-full text-lg font-semibold outline-none border-none mb-2"
            />
            <textarea
              placeholder="Enter Agent Description"
              className="w-full text-sm outline-none border-none resize-none mb-2"
            />
            <div className="flex flex-col gap-2">
              <p>
                <strong>System Prompt</strong>
              </p>
              <Textarea
                className="w-full text-sm mb-2 h-48"
                placeholder="Enter System Prompt"
              />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
