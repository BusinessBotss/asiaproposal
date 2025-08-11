import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  location: '',
  role: '',
  template: null,
  note: '',
};

const selectionSlice = createSlice({
  name: 'selection',
  initialState,
  reducers: {
    updateSelectedLocation: (state, action) => {
      state.location = action.payload;
    },
    updateSelectedRole: (state, action) => {
      state.role = action.payload;
    },
    updateSelectedTemplate: (state, action) => {
      state.template = action.payload;
    },
    updateNote: (state, action) => {
      state.note = action.payload;
    },
  },
});

export const {
  updateSelectedLocation,
  updateSelectedRole,
  updateSelectedTemplate,
  updateNote,
} = selectionSlice.actions;

export default selectionSlice.reducer;