
import React, { useRef, useState } from 'react';

import { Swiper, SwiperSlide } from 'swiper/react';
import Card from '../components/Therapists/Card1';

import 'swiper/css';
import 'swiper/css/pagination';
import 'swiper/css/navigation';


import { Pagination, Navigation, HashNavigation } from 'swiper/modules';

export default function TherapistPage() {
  return (
    <>
      <Swiper
        spaceBetween={30}
        hashNavigation={{
          watchState: true,
        }}
        pagination={{
          clickable: true,
        }}
        navigation={true}
        modules={[Pagination, Navigation, HashNavigation]}
        className="mySwiper bg-[#C7C2D9] z-10"
      >
        <SwiperSlide data-hash="slide1"><Card/></SwiperSlide>

       
      </Swiper>
    </>
  );
}
