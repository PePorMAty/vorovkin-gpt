// Flow.tsx
import React, { useCallback, useState, useEffect } from "react";
import { useSelector } from "react-redux";
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

// Импорты ваших функций и типов
import {
  applyLayoutToNodes,
  transformApiDataToFlow,
} from "./utils/dataTransformer";
import type { CustomNode, CustomEdge, CustomNodeData } from "./types";
import type { RootState } from "./store/store";
import { ProductNode } from "./components/product-node";
import { TransformationNode } from "./components/transformation-node";

// Типы для состояния GPT из store

const nodeTypes: NodeTypes = {
  product: ProductNode,
  transformation: TransformationNode,
};

// Кастомный стиль для связей
const edgeStyles = {
  stroke: "#b1b1b7",
  strokeWidth: 2,
};

export const Flow: React.FC = () => {
  // Получаем данные из Redux store
  const { data: apiData, loading } = useSelector(
    (state: RootState) => state.gpt
  );

  // Состояние React Flow
  const [nodes, setNodes, onNodesChange] = useNodesState<CustomNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<CustomEdge>([]);
  const { getEdges, deleteElements, getNode, fitView } = useReactFlow();

  // Состояние для меню узла
  const [nodeMenu, setNodeMenu] = useState<{
    id: string;
    top: number;
    left: number;
    label: string;
    description?: string;
  } | null>(null);

  // Загрузка и преобразование данных из store
  useEffect(() => {
    if (apiData && apiData.nodes && apiData.nodes.length > 0) {
      console.log("Обнаружены данные в store, начинаю преобразование...");

      try {
        // Преобразуем данные API в формат React Flow
        const { nodes: flowNodes, edges: flowEdges } =
          transformApiDataToFlow(apiData);

        // Улучшаем стиль связей - убираем подписи и настраиваем внешний вид
        const improvedEdges = flowEdges.map((edge) => ({
          ...edge,
          // Убираем label (подписи на связях)
          label: undefined,
          // Настраиваем стиль связей
          style: edgeStyles,
          // Тип связи для лучшего отображения
          type: "smoothstep",
          // Убираем анимацию по умолчанию
          animated: false,
        }));

        // Применяем автоматическое расположение
        const { nodes: layoutedNodes, edges: layoutedEdges } =
          applyLayoutToNodes(flowNodes, improvedEdges, "TB");

        setNodes(layoutedNodes);
        setEdges(layoutedEdges);

        // Подгоняем вид после рендера
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

  // Функция для поиска всех потомков узла
  const findAllDescendants = useCallback(
    (nodeId: string, allNodes: Node[], allEdges: Edge[]): Node[] => {
      const visited = new Set<string>();
      const stack: string[] = [nodeId];
      const descendants: Node[] = [];

      while (stack.length > 0) {
        const currentId = stack.pop()!;

        if (visited.has(currentId)) continue;
        visited.add(currentId);

        const outgoingEdges = allEdges.filter(
          (edge) => edge.source === currentId
        );

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
    },
    []
  );

  // Функция "умного" удаления
  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      const nodeToDelete = getNode(nodeId);
      if (!nodeToDelete) return;

      const nodesToDelete = new Set<string>([nodeId]);
      const edgesToDelete = new Set<string>();

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

      deleteElements({
        nodes: Array.from(nodesToDelete).map((id) => ({ id })),
        edges: Array.from(edgesToDelete).map((id) => ({ id })),
      });
      setNodeMenu(null);
    },
    [nodes, edges, deleteElements, getNode, findAllDescendants]
  );

  // Обработчик соединений
  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            type: ConnectionLineType.SmoothStep,
            animated: false,
            style: edgeStyles,
            label: undefined, // Убираем подписи для новых связей
          },
          eds
        )
      ),
    [setEdges]
  );

  // Функция для изменения лайаута
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

  // Функция для анализа зависимостей узла
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

  // Обработчик левого клика по узлу
  const onNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      const nodeData = node.data as CustomNodeData;

      setNodeMenu({
        id: node.id,
        top: event.clientY + 10,
        left: event.clientX + 10,
        label: nodeData.label,
        description: nodeData.description,
      });

      const dependencies = getNodeDependencies(node.id);
      console.log(`Узел ${nodeData.label} зависит от:`, dependencies);
    },
    [getNodeDependencies]
  );

  // Отображение состояний загрузки и ошибок
  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          flexDirection: "column",
        }}
      >
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
        // Улучшаем отображение связей
        defaultEdgeOptions={{
          type: "smoothstep",
          style: edgeStyles,
          animated: false,
          label: undefined, // Убираем подписи по умолчанию
        }}
        // Улучшаем z-index для правильного отображения связей
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

        {/* Меню узла */}
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
              <h3
                style={{ margin: "0 0 8px 0", fontSize: "16px", color: "#333" }}
              >
                {nodeMenu.label}
              </h3>
              {nodeMenu.description && (
                <p
                  style={{
                    margin: "0",
                    fontSize: "14px",
                    color: "#666",
                    lineHeight: "1.4",
                  }}
                >
                  {nodeMenu.description}
                </p>
              )}
            </div>

            <div
              style={{
                display: "flex",
                gap: "8px",
                justifyContent: "flex-end",
              }}
            >
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
      </ReactFlow>
    </div>
  );
};
