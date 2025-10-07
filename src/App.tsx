import { ReactFlowProvider } from "@xyflow/react";

import { Flow } from "./Flow";
import { MakeRequest } from "./make-request";

function App() {
  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        padding: "20px", // Создает отступ, где виден тёмный фон
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: "80%",
          height: "80%",
          border: "1px solid #333", // Граница для четкого отделения
          borderRadius: "8px",
          overflow: "hidden", // Важно: скрывает выходящие за границы части React Flow
          backgroundColor: "white", // Светлый фон на случай, если полотно не заполнит область
        }}
      >
        <ReactFlowProvider>
          <Flow />
        </ReactFlowProvider>
      </div>
      <MakeRequest />
    </div>
  );
}

export default App;
