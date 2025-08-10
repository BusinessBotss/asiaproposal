import { configureStore } from '@reduxjs/toolkit';
import selectionReducer from '../slices/selectionSlice';

export const store = configureStore({
  reducer: {
    selection: selectionReducer,
  },
});

export default store;