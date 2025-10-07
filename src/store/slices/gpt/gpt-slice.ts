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
    addNode: (state, action: PayloadAction<InputNode>) => {
      if (state.data?.nodes) {
        state.data.nodes.push(action.payload);
      }
    },
    
    // Удаление узла
    deleteNode: (state, action: PayloadAction<string>) => {
      if (state.data?.nodes) {
        state.data.nodes = state.data.nodes.filter(
          node => node["Id узла"] !== action.payload
        );
      }
    },
    
    // Обновление связей узла
    updateNodeConnections: (state, action: PayloadAction<{
      nodeId: string;
      inputs?: string[];
      outputs?: string[];
    }>) => {
      if (state.data?.nodes) {
        const nodeIndex = state.data.nodes.findIndex(
          node => node["Id узла"] === action.payload.nodeId
        );
        
        if (nodeIndex !== -1) {
          if (action.payload.inputs !== undefined) {
            state.data.nodes[nodeIndex]["Входы"] = action.payload.inputs;
          }
          if (action.payload.outputs !== undefined) {
            state.data.nodes[nodeIndex]["Выходы"] = action.payload.outputs;
          }
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
  updateNodeConnections,
  resetToInitial 
} = gptReducer.actions;

export default gptReducer.reducer;



