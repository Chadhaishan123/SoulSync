import React, { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { Link } from 'react-router-dom';

function Blog() {
    const blogs = useSelector(state => state.blogs);
    const [selectedBlog, setSelectedBlog] = useState(null);

    useEffect(() => {
        localStorage.setItem("blogs", JSON.stringify(blogs));
    }, [blogs]);

    const openBlog = (blog) => {
        setSelectedBlog(blog);
        setTimeout(() => {
            const modal = document.getElementById("my_modal");
            if (modal) {
                modal.showModal();
            }
        }, 0);
    };

    const closeModal = () => {
        setSelectedBlog(null);
        const modal = document.getElementById("my_modal");
        if (modal) {
            modal.close();
        }
    };
    return (
        <>
            <div className="p-4">
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 mb-4">
                    {blogs.map((blog) => (
                        <div 
                            key={blog.id} 
                            className="bg-white shadow-md rounded-lg p-6 hover:shadow-xl transition-shadow cursor-pointer" 
                            onClick={() => openBlog(blog)} // Updated to pass function reference
                        >
                            <h2 className="text-xl font-semibold mb-2">{blog.title}</h2>
                            <p className="text-gray-700">{blog.content}</p>
                        </div>
                    ))}
                </div>
                <div className="flex justify-end">
                    <Link to="/create-a-blog">
                        <button className="px-6 py-3 text-2xl bg-[#44444433] text-black rounded-full hover:bg-[#4444444d] hover:text-black transition duration-300">
                            Create your own
                        </button>
                    </Link>
                </div>
            </div>

            {selectedBlog && (
                <dialog id="my_modal" className="modal modal-bottom sm:modal-middle">
                    <div className="modal-box">
                        <h3 className="font-bold text-lg">{selectedBlog.title}</h3>
                        <p className="py-4">{selectedBlog.content}</p>
                        <div className="modal-action">
                            <button className="btn" onClick={closeModal}>Close</button>
                        </div>
                    </div>
                </dialog>
            )}
        </>
    )
}

export default Blog;
