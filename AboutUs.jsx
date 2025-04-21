import React from 'react';

const AboutUs = () => {
  return (
    <div className="flex flex-col lg:flex-row bg-white min-h-screen">
      <div className="flex-1 flex flex-col justify-center items-center px-4 lg:px-10 py-8 lg:py-0">
        <div className='text-center w-full mb-8'>
          <div className="text-6xl lg:text-8xl font-bold font-hanoble">ABOUT</div>
          <div className="mt-3 text-6xl lg:text-8xl font-light font-Bspring">US</div>
        </div>
        <div className="w-full max-w-3xl">
          <p className="text-base lg:text-lg text-justify">
            Welcome to SouLSynC! We're Ishan and Nandana - two UG CS students who started this platform with a simple belief: everyone deserves access to mental health support, no matter their age or walk of life. Our journey began with our own experiences navigating the challenges of student life, but it's grown into something much bigger.
          </p>
          <br />
          <p className="text-base lg:text-lg text-justify">
            As we've moved through our academic careers, we've not only faced our own mental health challenges but also witnessed close friends and family members struggle silently. We've seen brilliant minds cage themselves, afraid to seek help due to stigma or lack of resources. These experiences opened our eyes to a universal truth: mental health affects us all, regardless of age, background, or profession.
          </p>
        </div>
      </div>
      <img src="/AboutUs/BLine.svg" alt="line" className='hidden lg:block mr-5' />
    </div>
  );
};

export default AboutUs;