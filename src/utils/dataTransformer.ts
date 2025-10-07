import dagre from "@dagrejs/dagre";
import { Position } from "@xyflow/react";
import {
  type CustomNode,
  type CustomEdge,
  type CustomNodeData,
  type ApiResponse,
} from "../types";

// dataTransformer.ts
export function transformApiDataToFlow(apiData: ApiResponse): {
  nodes: CustomNode[];
  edges: CustomEdge[];
} {
  const nodes: CustomNode[] = [];
  const edges: CustomEdge[] = [];

  console.log(
    "Начало преобразования данных, всего элементов:",
    apiData.nodes.length
  );

  // Создаем узлы
  apiData.nodes.forEach((item, index) => {
    const isTransformation = item["Тип"]
      .toLowerCase()
      .includes("преобразование");
    const nodeType = isTransformation ? "transformation" : "product";

    const nodeData: CustomNodeData = {
      label: item["Название"],
      description: item["Описание"] || "",
      originalData: item,
    };

    const node: CustomNode = {
      id: item["Id узла"],
      type: nodeType,
      position: { x: 0, y: index * 100 },
      data: nodeData,
      draggable: true, // Разрешаем перетаскивание
    };

    nodes.push(node);
  });

  // Создаем связи
  apiData.nodes.forEach((item) => {
    // Создаем связи для входов
    if (item["Входы"] && Array.isArray(item["Входы"])) {
      item["Входы"].forEach((inputId, index) => {
        const sourceNodeExists = nodes.some((node) => node.id === inputId);
        const targetNodeExists = nodes.some(
          (node) => node.id === item["Id узла"]
        );

        if (sourceNodeExists && targetNodeExists) {
          const edge: CustomEdge = {
            id: `${inputId}-${item["Id узла"]}-input-${index}`,
            source: inputId,
            target: item["Id узла"],
            type: "smoothstep",
            animated: false,
            label: undefined,
            style: {
              stroke: "#b1b1b7",
              strokeWidth: 2,
            },
          };
          edges.push(edge);
        }
      });
    }

    // Создаем связи для выходов
    if (item["Выходы"] && Array.isArray(item["Выходы"])) {
      item["Выходы"].forEach((outputId, index) => {
        const sourceNodeExists = nodes.some(
          (node) => node.id === item["Id узла"]
        );
        const targetNodeExists = nodes.some((node) => node.id === outputId);

        if (sourceNodeExists && targetNodeExists) {
          const edge: CustomEdge = {
            id: `${item["Id узла"]}-${outputId}-output-${index}`,
            source: item["Id узла"],
            target: outputId,
            type: "smoothstep",
            animated: false,
            label: undefined,
            style: {
              stroke: "#b1b1b7",
              strokeWidth: 2,
            },
          };
          edges.push(edge);
        }
      });
    }
  });

  console.log(
    "Преобразование завершено. Узлы:",
    nodes.length,
    "Связи:",
    edges.length
  );
  return { nodes, edges };
}

// ... остальной код без изменений ...

export function applyLayoutToNodes(
  nodes: CustomNode[],
  edges: CustomEdge[],
  direction: "TB" | "LR" = "TB"
): { nodes: CustomNode[]; edges: CustomEdge[] } {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  const nodeWidth = 200; // Увеличиваем ширину для лучшего отображения
  const nodeHeight = 80; // Увеличиваем высоту

  const isHorizontal = direction === "LR";

  // Улучшаем настройки layout для лучшего расстояния
  dagreGraph.setGraph({
    rankdir: direction,
    ranksep: 100, // Увеличиваем расстояние между уровнями
    nodesep: 50, // Увеличиваем расстояние между узлами в одном уровне
  });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      targetPosition: isHorizontal ? Position.Left : Position.Top,
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}
