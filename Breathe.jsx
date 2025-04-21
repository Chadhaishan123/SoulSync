import React, { useState, useEffect } from 'react';
import "./Breathe.css";

function Breathe() {
  const [text, setText] = useState('Exhale');
 
  useEffect(() => {
    const interval = setInterval(() => {
      setText((prev) => (prev === 'Inhale' ? 'Exhale' : 'Inhale'));
    }, 7000); 

    return () => clearInterval(interval); 
  }, []);

  return (
    <div className='relative scale-[.5] -ml-[76px] -mt-44 -mb-24 sm:mt-0 sm:ml-10 sm:scale-90 '>
      <div className="circle2 ml-7 md:ml-0">
              <div className='md:font-Roca font-bold text-3xl'>{text}</div>
      </div>
      <div className="wrapper">
        <div className="circle blue"></div>
        <div className="circle green"></div>
        <div className="circle green"></div>
        <div className="circle green"></div>
        <div className="circle blue"></div>
        <div className="circle blue"></div>
        <div className="circle blue"></div>
        <div className="circle blue"></div>
      </div>
    </div>
  );
}

export default Breathe;
