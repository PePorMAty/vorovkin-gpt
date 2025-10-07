import { type Node, type Edge, type NodeProps } from "@xyflow/react";

// Типы для входных данных на основе вашей структуры
export interface InputNode {
  "Id узла": string;
  Тип: string;
  Название: string;
  Описание?: string;
  "Является природным сырьём"?: boolean;
  Входы?: string[];
  Выходы?: string[];
  [key: string]: unknown;
}

// Добавьте тип для создания нового узла
export interface NewNodeData {
  type: 'product' | 'transformation';
  label: string;
  description?: string;
  parentId?: string; // ID родительского узла, если узел создается через связь
}

export interface ApiResponse {
  nodes: InputNode[];
  has_more?: boolean;
}

export interface CustomNodeData {
  label: string;
  description?: string;
  originalData?: unknown;
  [key: string]: unknown;
}

// Добавьте тип для действия обновления узла
export interface UpdateNodePayload {
  nodeId: string;
  updates: Partial<InputNode>;
}

export interface InitialStateI {
  data: ApiResponse | null;
  loading: boolean;
  error: boolean | null;
}

export type CustomNode = Node<CustomNodeData>;
export type CustomEdge = Edge;

// Добавьте типы для пропсов компонентов узлов
export type ProductNodeProps = NodeProps<CustomNode>;
export type TransformationNodeProps = NodeProps<CustomNode>;
