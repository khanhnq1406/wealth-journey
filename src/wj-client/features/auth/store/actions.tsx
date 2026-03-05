import { REDUX_TYPE } from "@/app/constants";
import {
  AuthAction,
  AuthPayload,
  ModalAction,
  ModalPayload,
} from "./interface";

export const setAuth = (payload: AuthPayload): AuthAction => {
  return {
    type: REDUX_TYPE.SET_AUTH,
    payload: payload,
  };
};

export const removeAuth = () => {
  return {
    type: REDUX_TYPE.REMOVE_AUTH,
  };
};

export const openModal = (payload: ModalPayload): ModalAction => {
  return {
    type: REDUX_TYPE.OPEN_MODAL,
    payload: payload,
  };
};

export const closeModal = () => {
  return {
    type: REDUX_TYPE.CLOSE_MODAL,
  };
};
