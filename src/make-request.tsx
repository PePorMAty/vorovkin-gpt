import React, { useState } from "react";
import { useAppDispatch } from "./store/store";
import { gptRequest } from "./store/slices/gpt/gpt-slice";

export const MakeRequest = () => {
  const [value, setValue] = useState("");
  const dispatch = useAppDispatch();

  const handleOnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
  };

  const sendRequest = () => {
    dispatch(gptRequest(value));
  };

  const handleOnClick = () => {
    sendRequest();
  };

  return (
    <div>
      <input type="text" value={value} onChange={(e) => handleOnChange(e)} />
      <button onClick={handleOnClick}>Сгенерировать</button>
    </div>
  );
};
