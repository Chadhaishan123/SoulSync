import React , {useEffect} from 'react'
import Context from '../components/Talk/Context'
import Steps from '../components/Talk/Steps'
import AI from '../components/Talk/AI'
import Lenis from '@studio-freight/lenis';
function Talk() {
  useEffect(() => {
    const lenis = new Lenis();

    function raf(time) {
        lenis.raf(time);
        requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);
}, []);

  return (
    <div className='bg-[#C7C2D9] pt-28'>
        <Context/>
        <Steps/>
        <AI/>
    </div>
  )
}

export default Talk