import React from 'react';
import { Link } from 'react-router-dom';
import './Detox.css'

function Detox() {
  return (
    <div className='bg-[#FBF4EE] text-center'>
      <div className='p-4 sm:p-7 text-4xl sm:text-6xl font-betofin'>Digital Detox</div>
      <div className='text-center text-xl sm:text-3xl bg-[#372E2C] text-white opacity-70 p-4'>
        Harmonize Your Inner Self And Your Body While
        <div className='text-center'>Meditating Your Blues Away.</div>
      </div>
      <div className='bg-white rounded-full h-64 w-64 sm:h-96 sm:w-96 mx-auto relative'>
        <div className='sm:flex hidden'>
          <img src="/Detox/women.svg" alt="w" className='-mt-24 -ml-20 scale-110 z-10' />
          <img src="/Detox/men.svg" alt="m" className='-mt-40 -ml-48 ' />
        </div>
        <div className='sm:hidden'>
          <img src="/Detox/women.svg" alt="w" className='absolute  top-[88px] left-1/2 transform  -translate-x-1/2 -translate-y-1/2 scale-125' />
        </div>
      </div>
      <Link to="/digital-detox">
        <button className="mb-7 px-4 sm:px-6 py-2 sm:py-3 mt-6 sm:mt-10 text-xl sm:text-2xl bg-[#E8D9CA] border-4 border-black text-black rounded-full hover:bg-[#DFDBF4] hover:text-black transition duration-300 hover:text-medium hover:font-semibold">
          Explore Now
        </button>
      </Link>
    </div>
  );
}

export default Detox;
