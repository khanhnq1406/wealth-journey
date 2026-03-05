import { REDUX_TYPE } from "@/app/constants";
import { AuthAction, ModalAction } from "./interface";

export const setAuthReducer = (
  state = { email: null, isAuthenticated: null, fullname: null, picture: null, preferredCurrency: "VND" },
  action: AuthAction
) => {
  switch (action.type) {
    case REDUX_TYPE.SET_AUTH: {
      return {
        isAuthenticated: action.payload.isAuthenticated,
        email: action.payload.email,
        fullname: action.payload.fullname,
        picture: action.payload.picture,
        preferredCurrency: action.payload.preferredCurrency || "VND",
      };
    }
    case REDUX_TYPE.REMOVE_AUTH: {
      return {
        email: null,
        isAuthenticated: null,
        fullname: null,
        picture: null,
        preferredCurrency: "VND",
      };
    }
    default:
      return state;
  }
};

export const setModalReducer = (
  state = { isOpen: false, type: null },
  action: ModalAction
) => {
  switch (action.type) {
    case REDUX_TYPE.OPEN_MODAL: {
      return action.payload;
    }
    case REDUX_TYPE.CLOSE_MODAL: {
      return {
        isOpen: false,
        type: null,
      };
    }
    default:
      return state;
  }
};
