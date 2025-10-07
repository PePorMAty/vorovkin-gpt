// Flow.tsx
import React, { useCallback, useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
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
  getConnectedEdges,
  type NodeTypes,
  ConnectionMode,
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
import { updateNode, deleteNode, addConnection, removeConnection, addNode } from "./store/slices/gpt/gpt-slice";

const nodeTypes: NodeTypes = {
  product: ProductNode,
  transformation: TransformationNode,
};

const edgeStyles = {
  stroke: "#b1b1b7",
  strokeWidth: 2,
};

export const Flow: React.FC = () => {
  const dispatch = useDispatch();
  const { data: apiData, loading } = useSelector(
    (state: RootState) => state.gpt
  );

  const [nodes, setNodes, onNodesChange] = useNodesState<CustomNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<CustomEdge>([]);
  const { deleteElements, getNode, fitView } = useReactFlow(); // Убрали getEdges

  const [nodeMenu, setNodeMenu] = useState<{
    id: string;
    top: number;
    left: number;
    label: string;
    description?: string;
    type: string;
    nodeType: 'product' | 'transformation';
  } | null>(null);

  const [edgeMenu, setEdgeMenu] = useState<{
    id: string;
    top: number;
    left: number;
    sourceId: string;
    targetId: string;
  } | null>(null);

  const [editingNode, setEditingNode] = useState<{
    id: string;
    label: string;
    description: string;
    type: string;
  } | null>(null);

  const [newNodeModal, setNewNodeModal] = useState<{
    parentId: string;
    parentType: 'product' | 'transformation';
    newNodeType: 'product' | 'transformation';
  } | null>(null);

  const [newNodeData, setNewNodeData] = useState({
    label: '',
    description: ''
  });

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

  // Функция для проверки допустимости связи (исправленная версия)
  const isValidConnection = useCallback(
    (edge: Connection | Edge) => {
      // Приводим к Connection для единообразия
      const connection = edge as Connection;
      
      if (!connection.source || !connection.target) return false;

      const sourceNode = getNode(connection.source);
      const targetNode = getNode(connection.target);

      if (!sourceNode || !targetNode) return false;

      const sourceType = sourceNode.type;
      const targetType = targetNode.type;

      // Разрешаем связи только: Продукт -> Преобразование и Преобразование -> Продукт
      // Запрещаем: Продукт -> Продукт и Преобразование -> Преобразование
      return (
        (sourceType === 'product' && targetType === 'transformation') ||
        (sourceType === 'transformation' && targetType === 'product')
      );
    },
    [getNode]
  );

  // Функция для получения доступного типа узла для добавления
  const getAvailableNodeType = useCallback((nodeType: 'product' | 'transformation'): 'product' | 'transformation' => {
    return nodeType === 'product' ? 'transformation' : 'product';
  }, []);

  // Функция для открытия модалки добавления нового узла
  const handleAddNewNode = useCallback((parentId: string, parentType: 'product' | 'transformation') => {
    const newNodeType = getAvailableNodeType(parentType);
    setNewNodeModal({
      parentId,
      parentType,
      newNodeType
    });
    setNewNodeData({
      label: '',
      description: ''
    });
    setNodeMenu(null);
  }, [getAvailableNodeType]);

  // Функция для сохранения нового узла (исправленная версия)
  const handleSaveNewNode = useCallback(() => {
  if (newNodeModal && newNodeData.label.trim()) {
    dispatch(addNode({
      nodeData: {
        type: newNodeModal.newNodeType,
        label: newNodeData.label,
        description: newNodeData.description
      },
      parentId: newNodeModal.parentId
    }));
    setNewNodeModal(null);
    setNewNodeData({ label: '', description: '' });
  }
}, [newNodeModal, newNodeData, dispatch]);

  // Функция для отмены создания нового узла
  const handleCancelNewNode = useCallback(() => {
    setNewNodeModal(null);
    setNewNodeData({ label: '', description: '' });
  }, []);

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

  // Упрощенная функция удаления узла (только выбранный узел)
  const handleDeleteNode = useCallback((nodeId: string) => {
    const nodeToDelete = getNode(nodeId);
    if (!nodeToDelete) return;

    // Находим все связи, связанные с этим узлом
    const connectedEdges = getConnectedEdges([nodeToDelete], edges);
    const edgeIdsToDelete = connectedEdges.map(edge => edge.id);

    // Удаляем из Redux store
    dispatch(deleteNode(nodeId));
    
    // Удаляем из React Flow
    deleteElements({
      nodes: [{ id: nodeId }],
      edges: edgeIdsToDelete.map(id => ({ id })),
    });
    
    setNodeMenu(null);
  }, [edges, deleteElements, getNode, dispatch]);

  // Функция для удаления связи
  const handleDeleteEdge = useCallback((edgeId: string) => {
    const edge = edges.find(e => e.id === edgeId);
    if (edge) {
      // Удаляем связь из Redux store
      dispatch(removeConnection({
        sourceId: edge.source,
        targetId: edge.target
      }));
      
      // Удаляем связь из React Flow
      setEdges(eds => eds.filter(e => e.id !== edgeId));
    }
    setEdgeMenu(null);
  }, [edges, setEdges, dispatch]);

  // Обработчик создания связей
  const onConnect = useCallback(
    (params: Connection) => {
      if (!isValidConnection(params)) {
        console.log('Недопустимая связь');
        return;
      }

      // Добавляем связь в React Flow
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
      );

      // Добавляем связь в Redux store
      if (params.source && params.target) {
        dispatch(addConnection({
          sourceId: params.source,
          targetId: params.target
        }));
      }
    },
    [setEdges, dispatch, isValidConnection]
  );

  // Обработчик клика по связи
  const onEdgeClick = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      setEdgeMenu({
        id: edge.id,
        top: event.clientY + 10,
        left: event.clientX + 10,
        sourceId: edge.source,
        targetId: edge.target,
      });
      setNodeMenu(null); // Закрываем меню узла если открыто
    },
    []
  );

  // Обработчик удаления связей через изменения
  const onEdgesChangeCustom = useCallback(
    (changes: EdgeChange[]) => {
      changes.forEach(change => {
        if (change.type === 'remove') {
          const edge = edges.find(e => e.id === change.id);
          if (edge) {
            // Удаляем связь из Redux store
            dispatch(removeConnection({
              sourceId: edge.source,
              targetId: edge.target
            }));
          }
        }
      });
      
      // Применяем стандартные изменения
      onEdgesChange(changes);
    },
    [edges, onEdgesChange, dispatch]
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
        type: originalNode?.["Тип"] || "",
        nodeType: node.type as 'product' | 'transformation'
      });
      setEdgeMenu(null); // Закрываем меню связи если открыто
    },
    [apiData]
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
        onEdgesChange={onEdgesChangeCustom as (changes: EdgeChange[]) => void}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={() => {
          setNodeMenu(null);
          setEdgeMenu(null);
        }}
        connectionLineType={ConnectionLineType.SmoothStep}
        nodesDraggable={true}
        nodeTypes={nodeTypes}
        fitView
        maxZoom={10}
        defaultEdgeOptions={{
          type: "smoothstep",
          style: edgeStyles,
          animated: false,
          label: undefined,
        }}
        // Исправленные пропсы для новой версии React Flow
        elevateEdgesOnSelect={true}
        elevateNodesOnSelect={true}
        selectNodesOnDrag={false}
        connectionMode={ConnectionMode.Loose}
        deleteKeyCode={null} // Отключаем удаление по клавише Delete
        isValidConnection={isValidConnection}
      >
        <Panel position="top-right">
          
          <button 
            onClick={() => onLayout("TB")}
            style={{
              background: "#007bff",
              color: "white",
              border: "none",
              padding: "8px 16px",
              borderRadius: "4px",
              cursor: "pointer",
              margin: "4px",
            }}
          >
            Вертикальный layout
          </button>
          <button 
            onClick={() => onLayout("LR")}
            style={{
              background: "#007bff",
              color: "white",
              border: "none",
              padding: "8px 16px",
              borderRadius: "4px",
              cursor: "pointer",
              margin: "4px",
            }}
          >
            Горизонтальный layout
          </button>
          <div style={{ background: 'white', padding: '8px', borderRadius: '4px', fontSize: '12px', float: "left" }}>
          <div>Узлы: {nodes.length}</div>
            <div>Связи: {edges.length}</div>
            <div>API данные: {apiData ? '✓' : '✗'}</div>
            </div>
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
                onClick={() => handleAddNewNode(nodeMenu.id, nodeMenu.nodeType)}
                style={{
                  background: "#28a745",
                  border: "none",
                  borderRadius: "4px",
                  padding: "6px 12px",
                  cursor: "pointer",
                  color: "white",
                  fontSize: "14px",
                }}
              >
                Добавить связь {nodeMenu.nodeType === 'product' ? 'Преобразование' : 'Продукт'}
              </button>
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

        {/* Меню связи */}
        {edgeMenu && (
          <div
            style={{
              position: "fixed",
              top: edgeMenu.top,
              left: edgeMenu.left,
              background: "white",
              border: "1px solid #ccc",
              borderRadius: "8px",
              padding: "16px",
              zIndex: 1000,
              boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
              minWidth: "150px",
            }}
          >
            <div style={{ marginBottom: "12px" }}>
              <h3 style={{ margin: "0 0 8px 0", fontSize: "16px", color: "#333" }}>
                Связь
              </h3>
              <p style={{ margin: "0", fontSize: "12px", color: "#666" }}>
                ID: {edgeMenu.id}
              </p>
            </div>

            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button
                onClick={() => setEdgeMenu(null)}
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
                onClick={() => handleDeleteEdge(edgeMenu.id)}
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
                Удалить связь
              </button>
            </div>
          </div>
        )}

        {/* Модальное окно добавления нового узла */}
        {newNodeModal && (
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
              Добавить новый узел
            </h3>
            
            <div style={{ marginBottom: "16px" }}>
              <p style={{ margin: "0 0 8px 0", fontSize: "14px", color: "#666" }}>
                Тип нового узла: <strong>{newNodeModal.newNodeType === 'product' ? 'Продукт' : 'Преобразование'}</strong>
              </p>
              <p style={{ margin: "0 0 16px 0", fontSize: "12px", color: "#888" }}>
                {newNodeModal.parentType === 'product' 
                  ? 'Продукт может быть связан только с Преобразованием' 
                  : 'Преобразование может быть связано только с Продуктом'}
              </p>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: "bold" }}>
                Название:
              </label>
              <input
                type="text"
                value={newNodeData.label}
                onChange={(e) => setNewNodeData(prev => ({...prev, label: e.target.value}))}
                placeholder="Введите название узла"
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
                Описание (необязательно):
              </label>
              <textarea
                value={newNodeData.description}
                onChange={(e) => setNewNodeData(prev => ({...prev, description: e.target.value}))}
                placeholder="Введите описание узла"
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
                onClick={handleCancelNewNode}
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
                onClick={handleSaveNewNode}
                disabled={!newNodeData.label.trim()}
                style={{
                  background: "#28a745",
                  border: "none",
                  borderRadius: "4px",
                  padding: "8px 16px",
                  cursor: newNodeData.label.trim() ? "pointer" : "not-allowed",
                  color: "white",
                  fontSize: "14px",
                  opacity: newNodeData.label.trim() ? 1 : 0.6,
                }}
              >
                Добавить узел
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