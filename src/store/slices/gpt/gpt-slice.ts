import { configFile } from './../../../utils/config';
import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import axios from "axios";

import type { ApiResponse, InitialStateI, InputNode } from "../../../types";



const initialState: InitialStateI = {
  loading: false,
  data: {
    nodes: [],
  },
  error: false,
};

// Функция для генерации уникального ID
const generateNodeId = () => `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

export const gptRequest = createAsyncThunk<ApiResponse, string>(
  "gptReducer/gptRequest",
  async (gptPromt, thunkAPI) => {
    try {
      const response = await axios.post(
        configFile.API_URL,
        {
          model: "gpt-4.1",
          input: `${configFile.API_LAYOUT}, вот сам промт - ${gptPromt}`,
          tools: [{ type: "web_search_preview" }],
        },
        {
          headers: {
            Authorization: `Bearer ${configFile.API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      const textResponse = response.data.output[0].content[0].text;

      const extractAndParseJSON = (text: string) => {
        try {
          // 1. Извлекаем JSON из markdown блока
          const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/);
          if (!jsonMatch || !jsonMatch[1]) {
            throw new Error("Не найден JSON блок в ответе");
          }

          let jsonString = jsonMatch[1];
          console.log(
            "Извлеченный JSON:",
            jsonString.substring(0, 200) + "..."
          );

          // 2. Очищаем JSON от комментариев и лишних символов
          jsonString = jsonString
            // Удаляем однострочные комментарии
            .replace(/\/\/.*$/gm, "")
            // Удаляем многострочные комментарии
            .replace(/\/\*[\s\S]*?\*\//g, "")
            // Убираем висящие запятые перед закрывающими скобками
            .replace(/,\s*}/g, "}")
            // Убираем висящие запятые перед закрывающими квадратными скобками
            .replace(/,\s*]/g, "]")
            // Удаляем лишние пробелы и переносы
            .trim();

          console.log("Очищенный JSON:", jsonString.substring(0, 200) + "...");

          // 3. Парсим JSON
          const parsedData = JSON.parse(jsonString);
          console.log("JSON успешно распарсен");

          return parsedData;
        } catch (error) {
          console.error("Ошибка при обработке JSON:", error);
          throw new Error(`Не удалось обработать JSON из ответа: ${error}`);
        }
      };

      // Преобразуем текст в JSON
      const jsonData = extractAndParseJSON(textResponse);

      return jsonData;
    } catch (error) {
      return thunkAPI.rejectWithValue(error);
    }
  }
);

const gptReducer = createSlice({
  name: "gpt",
  initialState,
  reducers: {
    // Обновление узла
    updateNode: (state, action: PayloadAction<{
      nodeId: string;
      updates: Partial<InputNode>;
    }>) => {
      if (state.data?.nodes) {
        const nodeIndex = state.data.nodes.findIndex(
          node => node["Id узла"] === action.payload.nodeId
        );
        
        if (nodeIndex !== -1) {
          state.data.nodes[nodeIndex] = {
            ...state.data.nodes[nodeIndex],
            ...action.payload.updates
          };
        }
      }
    },
    
    // Добавление нового узла
     // Добавление нового узла (исправленная сигнатура)
    addNode: (state, action: PayloadAction<{
      nodeData: {
        type: 'product' | 'transformation';
        label: string;
        description?: string;
      };
      parentId?: string; // ID родительского узла для создания связи
    }>) => {
      if (state.data?.nodes) {
        const { nodeData, parentId } = action.payload;
        const newNodeId = generateNodeId();
        
        // Создаем новый узел
        const newNode: InputNode = {
          "Id узла": newNodeId,
          "Тип": nodeData.type === 'product' ? 'Продукт' : 'Преобразование',
          "Название": nodeData.label,
          "Описание": nodeData.description || '',
          "Входы": [],
          "Выходы": [],
        };

        // Добавляем новый узел
        state.data.nodes.push(newNode);

        // Если указан родительский узел, создаем связь
        if (parentId) {
          const parentNode = state.data.nodes.find(node => node["Id узла"] === parentId);
          
          if (parentNode) {
            // Определяем направление связи в зависимости от типов
            if (parentNode["Тип"]?.toLowerCase().includes("продукт") && nodeData.type === 'transformation') {
              // Продукт -> Преобразование
              if (!parentNode["Выходы"]) parentNode["Выходы"] = [];
              parentNode["Выходы"].push(newNodeId);
              
              if (!newNode["Входы"]) newNode["Входы"] = [];
              newNode["Входы"].push(parentId);
            } else if (parentNode["Тип"]?.toLowerCase().includes("преобразование") && nodeData.type === 'product') {
              // Преобразование -> Продукт
              if (!parentNode["Выходы"]) parentNode["Выходы"] = [];
              parentNode["Выходы"].push(newNodeId);
              
              if (!newNode["Входы"]) newNode["Входы"] = [];
              newNode["Входы"].push(parentId);
            }
          }
        }
      }
    },
    
    // Удаление только одного узла (без потомков)
    deleteNode: (state, action: PayloadAction<string>) => {
      if (state.data?.nodes) {
        state.data.nodes = state.data.nodes.filter(
          node => node["Id узла"] !== action.payload
        );
        
        // Также удаляем все связи, связанные с этим узлом
        state.data.nodes.forEach(node => {
          // Удаляем из входов других узлов
          if (node["Входы"] && Array.isArray(node["Входы"])) {
            node["Входы"] = node["Входы"].filter(inputId => inputId !== action.payload);
          }
          // Удаляем из выходов других узлов
          if (node["Выходы"] && Array.isArray(node["Выходы"])) {
            node["Выходы"] = node["Выходы"].filter(outputId => outputId !== action.payload);
          }
        });
      }
    },
    
    // Добавление связи между узлами
    addConnection: (state, action: PayloadAction<{
      sourceId: string;
      targetId: string;
    }>) => {
      if (state.data?.nodes) {
        const { sourceId, targetId } = action.payload;
        
        // Находим source узел (преобразование) и добавляем выход
        const sourceNode = state.data.nodes.find(node => node["Id узла"] === sourceId);
        if (sourceNode && sourceNode["Тип"]?.toLowerCase().includes("преобразование")) {
          if (!sourceNode["Выходы"]) {
            sourceNode["Выходы"] = [];
          }
          if (!sourceNode["Выходы"].includes(targetId)) {
            sourceNode["Выходы"].push(targetId);
          }
        }
        
        // Находим target узел и добавляем вход
        const targetNode = state.data.nodes.find(node => node["Id узла"] === targetId);
        if (targetNode) {
          if (!targetNode["Входы"]) {
            targetNode["Входы"] = [];
          }
          if (!targetNode["Входы"].includes(sourceId)) {
            targetNode["Входы"].push(sourceId);
          }
        }
      }
    },
    
    // Удаление связи между узлами
    removeConnection: (state, action: PayloadAction<{
      sourceId: string;
      targetId: string;
    }>) => {
      if (state.data?.nodes) {
        const { sourceId, targetId } = action.payload;
        
        // Удаляем выход из source узла
        const sourceNode = state.data.nodes.find(node => node["Id узла"] === sourceId);
        if (sourceNode && sourceNode["Выходы"]) {
          sourceNode["Выходы"] = sourceNode["Выходы"].filter(id => id !== targetId);
        }
        
        // Удаляем вход из target узла
        const targetNode = state.data.nodes.find(node => node["Id узла"] === targetId);
        if (targetNode && targetNode["Входы"]) {
          targetNode["Входы"] = targetNode["Входы"].filter(id => id !== sourceId);
        }
      }
    },
    
    // Сброс к исходным данным
    resetToInitial: (state, action: PayloadAction<ApiResponse>) => {
      state.data = action.payload;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(gptRequest.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(gptRequest.fulfilled, (state, action) => {
      state.data = action.payload;
      state.loading = false;
    });
    builder.addCase(gptRequest.rejected, (state) => {
      state.loading = false;
      state.error = true;
    });
  },
});

// Экспортируем actions для использования в компонентах
export const { 
  updateNode, 
  addNode, 
  deleteNode, 
  addConnection,
  removeConnection,
  resetToInitial 
} = gptReducer.actions;

export default gptReducer.reducer;




  



