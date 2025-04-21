import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { addBlog } from '../../Slice/BlogSlice';
import { useNavigate } from 'react-router-dom'; 

function Create() {
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const dispatch = useDispatch();
    const navigate = useNavigate();

    const addBlogHandler = async (e) => {
        e.preventDefault();

        await dispatch(addBlog({ title, content }));

        navigate('/blogs');
    };

    return (
        <div className="p-4 bg-white shadow-md rounded-lg max-w-md mx-auto">
            <h2 className="text-2xl font-semibold mb-4">Create a Blog</h2>
            <form onSubmit={addBlogHandler}>
                <div className="mb-4">
                    <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="title">
                        Title
                    </label>
                    <input
                        type="text"
                        id="title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring focus:ring-blue-200"
                        required
                    />
                </div>
                <div className="mb-4">
                    <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="content">
                        Content
                    </label>
                    <textarea
                        id="content"
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring focus:ring-blue-200"
                        required
                    />
                </div>
                <button
                    type="submit"
                    className="px-6 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition duration-300"
                >
                    Submit
                </button>
            </form>
        </div>
    );
}

export default Create;
