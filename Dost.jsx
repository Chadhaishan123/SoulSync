import React from 'react';
import { Link } from 'react-router-dom';
function Dost() {
    return ( 
        <div className='p-4'>
            <div className='flex flex-col md:flex-row justify-between'>
                <div className=''>
                <div className=' relative  flex justify-center align-center font-Roca text-6xl md:text-7xl text-white ' style={{ WebkitTextStroke: '2px black' }}>Student Support Hub:
            </div>
            <div className='mt-10 text-3xl md:text-5xl md:ml-20 text-center'> Affordable Therapy & Round-the-Clock AI Companion.</div>
                    {/* <div className='font-Roca text-4xl sm:text-5xl md:text-6xl text-[#7b36d6] p-6 md:p-14 pt-10 md:pt-20 ' >
                       <span className='underline decoration-black'>Student Support Hub:</span>
                    <div className='mt-10'> Affordable Therapy & Round-the-Clock AI Companion.</div>
                    </div> */}
                    <Link to= '/talk-with-ai' >
                        <button className="mt-12 ml-24 md:ml-[500px] mb-14 px-4 py-2 md:px-6 md:py-3 text-2xl sm:text-3xl md:text-4xl bg-white border-2 border-black text-black hover:font-semibold rounded-full hover:bg-[#e1e3e6] hover:text-black transition duration-300 hover:text-medium">
                            Explore
                        </button>
                    </Link>
                </div>
                <img src="/Dost/dost.svg" alt="dost" className='scale-75 mt-6 md:mt-0' />
            </div>
        </div>
    );
}

export default Dost;
