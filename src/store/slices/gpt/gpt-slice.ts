import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";
import { configFile } from "../../../config";
import type { ApiResponse } from "../../../types";

export interface InitialStateI {
  data: ApiResponse | null;
  loading: boolean;
  error: boolean | null;
}

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
            Authorization: `Bearer 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`,
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
  reducers: {},
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

export default gptReducer.reducer;
