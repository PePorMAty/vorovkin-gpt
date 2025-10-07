import React, { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "./store/store";
import { gptRequest } from "./store/slices/gpt/gpt-slice";

export const MakeRequest = () => {
  const [value, setValue] = useState("");
  const [gptRes, setGptRes] = useState([]);
  const dispatch = useAppDispatch();
  const { data } = useAppSelector((state) => state.gpt);
  console.log(data);
  useEffect(() => {
    setGptRes(data);
  }, [data, gptRes]);

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
      {/* {data.nodes.map((elem: any) => {
        <div>{elem}</div>;
      })} */}
    </div>
  );
};
