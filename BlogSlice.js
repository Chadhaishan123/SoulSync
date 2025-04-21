import { createSlice, nanoid } from "@reduxjs/toolkit";

const storedBlogs = JSON.parse(localStorage.getItem("blogs")) || [];

const initialState = {
    blogs: storedBlogs.length > 0 ? storedBlogs : [
        {
            id: nanoid(),
            title: "JEE Journey",
            content: "It was way tougher. Consistency and revision are the keys."
        },
        {
            id: nanoid(),
            title: "First Day at School",
            content: "It was weird, and I thought it would be boring, but it was interesting."
        },
        {
            id: nanoid(),
            title: "Board Exams",
            content: "PYQs and practice are the keys."
        },
    ]
}

export const blogSlice = createSlice({
    name: "blog",
    initialState,
    reducers: {
        addBlog: (state, action) => {
            const blog = {
                id: nanoid(),
                title: action.payload.title,
                content: action.payload.content,
            }
            state.blogs.push(blog);
        }
    }
})

export const { addBlog } = blogSlice.actions;
export const blogReducer = blogSlice.reducer;
