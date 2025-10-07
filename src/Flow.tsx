// Flow.tsx
import React, { useCallback, useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux"; // Добавляем useDispatch
import {
  Background,
  ReactFlow,
  addEdge,
  ConnectionLineType,
  Panel,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Node,
  type Edge,
  type Connection,
  type NodeChange,
  type EdgeChange,
  getIncomers,
  getConnectedEdges,
  type NodeTypes,
} from "@xyflow/react";

import "@xyflow/react/dist/style.css";

import {
  applyLayoutToNodes,
  transformApiDataToFlow,
} from "./utils/dataTransformer";
import type { CustomNode, CustomEdge, CustomNodeData } from "./types";
import type { RootState } from "./store/store";
import { ProductNode } from "./components/product-node";
import { TransformationNode } from "./components/transformation-node";
import { deleteNode, updateNode } from "./store/slices/gpt/gpt-slice";
 // Импортируем actions

const nodeTypes: NodeTypes = {
  product: ProductNode,
  transformation: TransformationNode,
};

const edgeStyles = {
  stroke: "#b1b1b7",
  strokeWidth: 2,
};

export const Flow: React.FC = () => {
  const dispatch = useDispatch(); // Добавляем dispatch
  const { data: apiData, loading } = useSelector(
    (state: RootState) => state.gpt
  );

  const [nodes, setNodes, onNodesChange] = useNodesState<CustomNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<CustomEdge>([]);
  const { getEdges, deleteElements, getNode, fitView } = useReactFlow();

  const [nodeMenu, setNodeMenu] = useState<{
    id: string;
    top: number;
    left: number;
    label: string;
    description?: string;
    type: string;
  } | null>(null);

  // Состояние для редактирования
  const [editingNode, setEditingNode] = useState<{
    id: string;
    label: string;
    description: string;
    type: string;
  } | null>(null);

  // Загрузка и преобразование данных из store
  useEffect(() => {
    if (apiData && apiData.nodes && apiData.nodes.length > 0) {
      console.log("Обнаружены данные в store, начинаю преобразование...");

      try {
        const { nodes: flowNodes, edges: flowEdges } =
          transformApiDataToFlow(apiData);

        const improvedEdges = flowEdges.map((edge) => ({
          ...edge,
          label: undefined,
          style: edgeStyles,
          type: "smoothstep",
          animated: false,
        }));

        const { nodes: layoutedNodes, edges: layoutedEdges } =
          applyLayoutToNodes(flowNodes, improvedEdges, "TB");

        setNodes(layoutedNodes);
        setEdges(layoutedEdges);

        setTimeout(() => fitView(), 100);

        console.log("Данные из store успешно загружены в React Flow:", {
          nodes: layoutedNodes.length,
          edges: layoutedEdges.length,
        });
      } catch (error) {
        console.error("Ошибка преобразования данных из store:", error);
      }
    }
  }, [apiData, setNodes, setEdges, fitView]);

  // Функция для начала редактирования узла
  const handleEditNode = useCallback((nodeId: string) => {
    const node = getNode(nodeId);
    if (node) {
      const nodeData = node.data as CustomNodeData;
      const originalNode = apiData?.nodes.find(n => n["Id узла"] === nodeId);
      
      setEditingNode({
        id: nodeId,
        label: nodeData.label,
        description: nodeData.description || "",
        type: originalNode?.["Тип"] || ""
      });
      setNodeMenu(null);
    }
  }, [getNode, apiData]);

  // Функция для сохранения изменений узла
  const handleSaveNode = useCallback(() => {
    if (editingNode) {
      dispatch(updateNode({
        nodeId: editingNode.id,
        updates: {
          "Название": editingNode.label,
          "Описание": editingNode.description
        }
      }));
      setEditingNode(null);
    }
  }, [editingNode, dispatch]);

  // Функция для отмены редактирования
  const handleCancelEdit = useCallback(() => {
    setEditingNode(null);
  }, []);

  // Обновленная функция удаления узла
  const handleDeleteNode = useCallback((nodeId: string) => {
    const nodeToDelete = getNode(nodeId);
    if (!nodeToDelete) return;

    const nodesToDelete = new Set<string>([nodeId]);
    const edgesToDelete = new Set<string>();

    const findAllDescendants = (nodeId: string, allNodes: Node[], allEdges: Edge[]): Node[] => {
      const visited = new Set<string>();
      const stack: string[] = [nodeId];
      const descendants: Node[] = [];

      while (stack.length > 0) {
        const currentId = stack.pop()!;
        if (visited.has(currentId)) continue;
        visited.add(currentId);

        const outgoingEdges = allEdges.filter((edge) => edge.source === currentId);
        outgoingEdges.forEach((edge) => {
          if (!visited.has(edge.target)) {
            const childNode = allNodes.find((node) => node.id === edge.target);
            if (childNode) {
              descendants.push(childNode);
              stack.push(edge.target);
            }
          }
        });
      }
      return descendants;
    };

    const allDescendants = findAllDescendants(nodeId, nodes, edges);
    allDescendants.forEach((descendant) => {
      const allParents = getIncomers(descendant, nodes, edges);
      const remainingParents = allParents.filter(
        (parent) => !nodesToDelete.has(parent.id)
      );
      if (remainingParents.length === 0) {
        nodesToDelete.add(descendant.id);
      }
    });

    const nodesToDeleteObjects = nodes.filter((node) =>
      nodesToDelete.has(node.id)
    );
    const connectedEdges = getConnectedEdges(nodesToDeleteObjects, edges);
    connectedEdges.forEach((edge) => edgesToDelete.add(edge.id));

    // Удаляем из Redux store
    dispatch(deleteNode(nodeId));
    
    // Удаляем из React Flow
    deleteElements({
      nodes: Array.from(nodesToDelete).map((id) => ({ id })),
      edges: Array.from(edgesToDelete).map((id) => ({ id })),
    });
    
    setNodeMenu(null);
  }, [nodes, edges, deleteElements, getNode, dispatch]);

  // Остальные функции без изменений...
  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            type: ConnectionLineType.SmoothStep,
            animated: false,
            style: edgeStyles,
            label: undefined,
          },
          eds
        )
      ),
    [setEdges]
  );

  const onLayout = useCallback(
    (direction: "TB" | "LR") => {
      const { nodes: layoutedNodes, edges: layoutedEdges } = applyLayoutToNodes(
        nodes,
        edges,
        direction
      );
      setNodes([...layoutedNodes]);
      setEdges([...layoutedEdges]);
      setTimeout(() => fitView(), 100);
    },
    [nodes, edges, setNodes, setEdges, fitView]
  );

  const getNodeDependencies = useCallback(
    (nodeId: string): string[] => {
      const currentEdges = getEdges();
      const dependencies = new Set<string>();
      const stack: string[] = [nodeId];
      const visited = new Set<string>();

      while (stack.length > 0) {
        const currentId = stack.pop()!;
        if (visited.has(currentId)) continue;
        visited.add(currentId);

        const incomingEdges = currentEdges.filter(
          (edge) => edge.target === currentId
        );
        incomingEdges.forEach((edge) => {
          dependencies.add(edge.source);
          stack.push(edge.source);
        });
      }
      return Array.from(dependencies);
    },
    [getEdges]
  );

  const onNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      const nodeData = node.data as CustomNodeData;
      const originalNode = apiData?.nodes.find(n => n["Id узла"] === node.id);

      setNodeMenu({
        id: node.id,
        top: event.clientY + 10,
        left: event.clientX + 10,
        label: nodeData.label,
        description: nodeData.description,
        type: originalNode?.["Тип"] || ""
      });

      const dependencies = getNodeDependencies(node.id);
      console.log(`Узел ${nodeData.label} зависит от:`, dependencies);
    },
    [getNodeDependencies, apiData]
  );

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", flexDirection: "column" }}>
        <div>Загрузка данных из GPT...</div>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "100vh" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange as (changes: NodeChange[]) => void}
        onEdgesChange={onEdgesChange as (changes: EdgeChange[]) => void}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={() => setNodeMenu(null)}
        connectionLineType={ConnectionLineType.SmoothStep}
        nodesDraggable={false}
        nodeTypes={nodeTypes}
        fitView
        maxZoom={10}
        defaultEdgeOptions={{
          type: "smoothstep",
          style: edgeStyles,
          animated: false,
          label: undefined,
        }}
        elevateEdgesOnSelect={false}
        elevateNodesOnSelect={false}
      >
        <Panel position="top-right">
          <button className="xy-theme__button" onClick={() => onLayout("TB")}>
            Вертикальный layout
          </button>
          <button className="xy-theme__button" onClick={() => onLayout("LR")}>
            Горизонтальный layout
          </button>
        </Panel>
        <Background />

        {/* Меню узла с кнопкой редактирования */}
        {nodeMenu && (
          <div
            style={{
              position: "fixed",
              top: nodeMenu.top,
              left: nodeMenu.left,
              background: "white",
              border: "1px solid #ccc",
              borderRadius: "8px",
              padding: "16px",
              zIndex: 1000,
              boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
              minWidth: "200px",
              maxWidth: "300px",
            }}
          >
            <div style={{ marginBottom: "12px" }}>
              <h3 style={{ margin: "0 0 8px 0", fontSize: "16px", color: "#333" }}>
                {nodeMenu.label}
              </h3>
              <p style={{ margin: "0 0 4px 0", fontSize: "12px", color: "#888" }}>
                Тип: {nodeMenu.type}
              </p>
              {nodeMenu.description && (
                <p style={{ margin: "0", fontSize: "14px", color: "#666", lineHeight: "1.4" }}>
                  {nodeMenu.description}
                </p>
              )}
            </div>

            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button
                onClick={() => handleEditNode(nodeMenu.id)}
                style={{
                  background: "#007bff",
                  border: "none",
                  borderRadius: "4px",
                  padding: "6px 12px",
                  cursor: "pointer",
                  color: "white",
                  fontSize: "14px",
                }}
              >
                Редактировать
              </button>
              <button
                onClick={() => setNodeMenu(null)}
                style={{
                  background: "#f5f5f5",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  padding: "6px 12px",
                  cursor: "pointer",
                  fontSize: "14px",
                }}
              >
                Закрыть
              </button>
              <button
                onClick={() => handleDeleteNode(nodeMenu.id)}
                style={{
                  background: "#ff3b30",
                  border: "none",
                  borderRadius: "4px",
                  padding: "6px 12px",
                  cursor: "pointer",
                  color: "white",
                  fontSize: "14px",
                }}
              >
                Удалить
              </button>
            </div>
          </div>
        )}

        {/* Модальное окно редактирования */}
        {editingNode && (
          <div
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              background: "white",
              border: "1px solid #ccc",
              borderRadius: "8px",
              padding: "24px",
              zIndex: 1001,
              boxShadow: "0 8px 30px rgba(0,0,0,0.2)",
              minWidth: "400px",
              maxWidth: "500px",
            }}
          >
            <h3 style={{ margin: "0 0 16px 0", fontSize: "18px" }}>
              Редактирование узла
            </h3>
            
            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: "bold" }}>
                Название:
              </label>
              <input
                type="text"
                value={editingNode.label}
                onChange={(e) => setEditingNode(prev => prev ? {...prev, label: e.target.value} : null)}
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  fontSize: "14px",
                }}
              />
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: "bold" }}>
                Описание:
              </label>
              <textarea
                value={editingNode.description}
                onChange={(e) => setEditingNode(prev => prev ? {...prev, description: e.target.value} : null)}
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  fontSize: "14px",
                  minHeight: "80px",
                  resize: "vertical",
                }}
              />
            </div>

            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button
                onClick={handleCancelEdit}
                style={{
                  background: "#f5f5f5",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  padding: "8px 16px",
                  cursor: "pointer",
                  fontSize: "14px",
                }}
              >
                Отмена
              </button>
              <button
                onClick={handleSaveNode}
                style={{
                  background: "#007bff",
                  border: "none",
                  borderRadius: "4px",
                  padding: "8px 16px",
                  cursor: "pointer",
                  color: "white",
                  fontSize: "14px",
                }}
              >
                Сохранить
              </button>
            </div>
          </div>
        )}
      </ReactFlow>
    </div>
  );
};