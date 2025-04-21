import { configureStore } from "@reduxjs/toolkit";

import {blogReducer} from "../Slice/BlogSlice";

export const store = configureStore({
    reducer : blogReducer
});
