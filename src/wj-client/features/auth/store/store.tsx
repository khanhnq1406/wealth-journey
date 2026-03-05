import { combineReducers } from "redux";
import { configureStore } from "@reduxjs/toolkit";
import { setAuthReducer, setModalReducer } from "./reducer";

const rootReducer = combineReducers({
  setAuthReducer,
  setModalReducer,
});

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types
        ignoredActions: ['OPEN_MODAL'],
        // Ignore these field paths in all actions
        ignoredActionPaths: ['payload.onSuccess'],
        // Ignore these paths in the state
        ignoredPaths: ['setModalReducer.onSuccess'],
      },
    }),
});
