import React, { useState, useEffect } from 'react';
import { cardData } from './Adata';

const Acard = () => {
  const [selectedBlog, setSelectedBlog] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const openBlog = (blog) => {
    setSelectedBlog(blog);
    setTimeout(() => setIsModalOpen(true), 10);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setTimeout(() => setSelectedBlog(null), 300);
  };


  return (
    <>
      <div className={`flex flex-wrap gap-14 justify-center transition-all duration-300 ${isModalOpen ? 'blur-md' : ''}`}>
        {cardData.map((card, index) => (
          <div key={index} className="block w-full sm:w-1/3 md:w-1/4 lg:w-1/5 cursor-pointer" onClick={() => openBlog(card)}>
            <div className={`relative p-4 rounded-lg shadow-md ${card.cardBgColor}`}>
              <div className={`absolute rounded-bl-3xl top-0 right-0 h-1/2 w-12 ${card.sideBgColor} flex items-center justify-center`}>
                <div className="rotate-90 text-3xl font-bold text-[#122620]">{card.articleText}</div>
              </div>
              <div className="mr-8 h-full flex flex-col justify-between">
                <div>
                  <div className="relative">
                    <img src="/Brain/WBrain.svg" alt="brain" className="absolute -mt-4 -ml-4 w-40 h-28 object-cover" />
                    <h2 className="text-3xl text-[#122620] font-bold absolute top-0 left-0">{card.heading}</h2>
                  </div>
                  <p className="text-sm text-black ml-36 p-3 mt-10">{card.writer}<br />{card.date}</p>
                </div>
                <p className={`mt-7 text-black ml-2 ${(index==3)? 'mb-3 pt-3' : ''}`}>{card.catchy}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
      {selectedBlog && (
        <div 
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black transition-all duration-300 ${
            isModalOpen ? 'bg-opacity-50' : 'bg-opacity-0 pointer-events-none'
          }`}
          onClick={closeModal}
        >
          <div 
            className={`bg-white rounded-lg  md:w-10/12 overflow-y-auto transition-all duration-300 ${
              isModalOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
            }`}
           
          >
            <div className="p-6 md:h-auto h-[600px] ">
              <h3 className="font-bold text-lg mb-4 ">{selectedBlog.heading}</h3>
              <p className="mb-6">{selectedBlog.content}</p>
              <div className="text-right">
                <button 
                  className="px-4 py-2 mb-3 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors duration-300" 
                  onClick={closeModal}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Acard;