import React, { useState } from 'react';
import Service from '../../components/Service/Service';
import Breathe from '../../components/About/Breathe/Breathe';

function About() {
  const [open, setOpen] = useState(false);
  const handleOpen = () => {
    setOpen((prevValue) => !prevValue);
  };

  // Add transition to the style classes
  const style = open ? 'ml-0' : 'w-full -ml-72 mr-[300px]';

  return (
    <div>
      <div className='bg-[#E3DFF8] md:flex md:flex-nowrap relative'>
        <div className='mdpx-0 md:px-10 md:block hidden '><Breathe /></div>
        <div className='text-xl   md:block hidden md:text-3xl flex items-center pb-5 px-10 md:mt-10 md:mb-20 md:px-20'>
         <div className='font-rocaThin font-extrabold text-4xl'>
         Welcome to SoulSync!
         </div>
          
          <div className='mt-7 mb-6 text-justify'>
          Your one of a kind safe space for mental health. With a beautifully crafted fusion of AI in the field of mental health, something truly special to help and support you. It's more than just a place to book therapy sessions; it's a resource designed to help you find peace and balance using the power of technology. Whether you're looking for professional support, tools to lift your mood, or helpful information, SoulSync is here for you, with special support available for young adults and teenagers.
          </div>
          <div className='text-3xl font-medium'>
          Find your peace Now 🌻
          </div>
        </div>
        <div className={`absolute z-20 md:hidden block transition-all duration-500 ease-in-out h-32 ${style}`}>
          <div className={`h-[430px] mt-6 bg-black text-white rounded-xl flex p-3 z-20`}>
            <div className="text-justify">
              Welcome to Sukoon !
              <br /><br />
              Your one of a kind safe space for mental health. It's more than just a place to book therapy sessions; it's a resource designed to help you find peace and balance using the power of technology. Whether you're looking for professional support, tools to lift your mood, or helpful information, Sukoon is here for you, with special support available for young adults and teenagers.
              <br /><br />
              Find your Sukoon Now 🌻
            </div>
            <div className={` cursor-pointer flex items-center ${open ? '': 'pl-20 '}`} onClick={handleOpen}>
              <svg xmlns="http://www.w3.org/2000/svg" height="32" width="20" viewBox="0 0 320 512"><path fill="#ffffff" d="M278.6 233.4c12.5 12.5 12.5 32.8 0 45.3l-160 160c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3L210.7 256 73.4 118.6c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0l160 160z" /></svg>
            </div>
          </div>
        </div>
        <div className='md:hidden block px-0 md:px-10 z-0 relative'><Breathe /></div>
      </div>
      <div className='lg:block hidden'>
        <div className='text-[#3A409F] font-Roca text-4xl text-center p-4 font-bold'>"Healing happens one moment at a time, and we're here to help ✨"</div>
        <Service />
      </div>
    </div>
  );
}

export default About;
