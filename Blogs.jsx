import React, { useState, useEffect } from 'react';

function Blogs() {
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

    const blogs = [
        { 
            img: "/blog/d1.svg",
            title: "Coping with Anxiety",
            content : "Living with anxiety can feel like you're constantly battling an invisible monster. Trust me, I've been there. Some days, it's hard to even leave the house or have a normal conversation without feeling like your heart is going to burst out of your chest. But I'm here to tell you that there's hope, and with the right tools, you can learn to manage your anxiety and reclaim your life. First things first: knowledge is power. Understanding what's happening in your body when anxiety strikes can be incredibly empowering. That racing heart? It's just your body's natural fight-or-flight response kicking in, even when there's no real danger. Once I learned this, it became easier to talk myself down from panic attacks. One of the most helpful techniques I've discovered is mindfulness. It sounds a bit new-age-y, I know, but hear me out. Learning to focus on the present moment instead of getting caught up in anxious thoughts about the future has been a game-changer for me. There are tons of apps and YouTube videos that can guide you through simple mindfulness exercises. Breathing techniques have also been a lifesaver. When I feel anxiety creeping in, I focus on taking slow, deep breaths from my diaphragm. It's amazing how something so simple can have such a powerful effect on calming your nerves. Of course, lifestyle changes play a big role too. I've cut back on caffeine (goodbye, my beloved triple espressos), started exercising regularly, and made an effort to eat healthier. It hasn't always been easy, but the impact on my anxiety levels has been noticeable. Perhaps the most important step I've taken is learning to be kinder to myself. Anxiety had really done a number on my self-esteem, but through therapy and self-reflection, I'm slowly rebuilding my confidence. Remember, recovery is a journey, not a destination. Some days will be harder than others, and that's okay. The key is to keep trying, keep learning, and never be afraid to ask for help when you need it. Whether it's talking to a therapist, joining a support group, or leaning on friends and family, you don't have to face anxiety alone. If you're struggling with anxiety, I hope my story gives you a glimmer of hope. With patience, perseverance, and the right tools, it is possible to tame the anxiety beast and live a fuller, happier life.",
            catchy: "From Panic to Peace: One Person's Real-Life Guide to Conquering Anxiety",
            writer : "anonymous",
            date : "Jun 2024"
        },
        {
            img: "/blog/a1.svg",
            title: "My Journey with Depression",
            content : "Life with depression often feels like walking a tightrope. Some days, I'm confident and steady. Other days, I'm wobbling, desperately trying not to fall. But here's what I've learned: it's okay to wobble. It's part of the journey. I was diagnosed with major depressive disorder in my early twenties. At first, I thought, Great, I'll get treatment and be 'cured.' Oh, how naive I was! Depression, I've come to understand, isn't something you beat once and for all. It's more like an unwelcome houseguest that might show up at any time. The possibility of relapse used to terrify me. Every bad day sent me into a panic. Is it coming back? Should I change my meds? Am I falling apart again? But over time, I've learned that these fears, while valid, don't have to control me. My toolkit for staying balanced has evolved over the years. Sticking to a routine provides much-needed structure - regular sleep, meals, and activities anchor my days. Medication management is crucial; I've learned the hard way that consistency is key. Therapy offers a safe space to process my thoughts and learn new coping strategies. Self-care isn't just about bubble baths (though those are nice). It's about setting boundaries, saying no when I need to, and prioritizing my mental health. Building a strong support system has been vital - friends and family who understand, and a support group where I can be truly honest about my struggles. Some days, despite my best efforts, I still struggle. And that's okay. Recovery isn't linear. It's full of ups and downs, good days and bad. The key is to keep going, one step at a time. If you're walking your own tightrope with depression, know that you're not alone. It's a challenging journey, but with the right support and tools, you can find your balance. And on the days when you wobble? Remember, wobbling is still part of walking forward.",
            catchy: "Finding balance on the tightrope of depression - one step at a time.",
            writer : "anonymous",
            date : "Jun 2024"
        },
        {
            img: "/blog/sports.jpg",
            title: "The Emotional Rollercoaster of Sports: A Player's Perspective",
            catchy: "In sports, mastering your emotions is the ultimate game-changer.",
            content : "As an athlete, I've always known that sports are more than just physical. They're an emotional journey that can lift you to incredible highs and plunge you into crushing lows - sometimes within the span of a single game. I remember the first time I scored a game-winning goal. The rush of happiness was indescribable. My teammates and I were jumping, screaming, hugging - pure joy radiating from every pore. But I've also experienced the flip side: the gut-wrenching sadness of missing a crucial shot, letting my team down when it mattered most. These intense emotions aren't just side effects of playing sports; they're an integral part of the experience. They fuel our determination, push us to train harder, and create those unforgettable moments that define our careers. But here's the thing: managing these emotions is just as important as mastering any physical skill. I've learned (sometimes the hard way) that unchecked anger can lead to poor decisions on the field. Overwhelming anxiety before a big game can impact performance. Even excessive excitement can throw off your focus. Over the years, I've worked with sports psychologists to develop strategies for emotional regulation. It's not about suppressing emotions - that's impossible and counterproductive. Instead, it's about acknowledging them, understanding their impact, and channeling them effectively. Mindfulness techniques have been a game-changer for me. Taking a moment to breathe and center myself before a crucial play helps me stay focused. I've also learned the power of reframing negative thoughts. That missed shot isn't a failure; it's an opportunity to learn and improve. Perhaps most importantly, I've come to appreciate the role of my team and support system in managing emotions. Sharing both triumphs and disappointments with teammates creates a bond that goes beyond the game. It provides emotional validation and a sense of belonging that helps balance the psychological pressures of competitive sports. To any aspiring athletes out there, remember: your emotional well-being is just as crucial as your physical fitness. Don't be afraid to seek help from sports psychologists or mental health professionals. They can provide invaluable tools for navigating the emotional intensity of sports. In the end, it's this very emotional rollercoaster that makes sports so compelling. It's what connects us as athletes and fans, creating stories of triumph, heartbreak, and resilience that resonate far beyond the field.",
            writer : "anonymous",
            date : "Jun 2024"
        },
        {
            img: "/blog/anhedonia.jpg",
            title: "Rediscovering Joy: Understanding and Overcoming Anhedonia",
            content : "Anhedonia, meaning lacking pleasure in Greek, is a condition where individuals find it difficult to experience joy or satisfaction from activities that once brought them happiness. This can severely impact their quality of life, affecting hobbies, social interactions, and daily routines. Often linked to mental health disorders such as depression, schizophrenia, and PTSD, anhedonia can also be associated with chronic stress, trauma, and negative thinking patterns. The causes of anhedonia are complex, involving biological, psychological, and social factors. Neurochemical imbalances, particularly in dopamine and serotonin, disrupt the brain's reward system, while structural abnormalities in regions like the prefrontal cortex contribute to the condition. Social isolation and unhealthy lifestyle choices can further exacerbate the symptoms. Anhedonia presents with several key symptoms, including emotional flatness, a decreased interest in previously enjoyable activities, social withdrawal, and physical changes like altered sleep and appetite. These symptoms often lead to a diminished ability to connect with others, reduced productivity, and an overall decline in well-being. Treatment for anhedonia typically involves a combination of psychotherapy, medication, and lifestyle changes. Cognitive-behavioral therapy (CBT) can help individuals challenge negative thought patterns and gradually regain the ability to feel pleasure. Medications such as antidepressants may be prescribed to address underlying neurochemical imbalances. Incorporating regular exercise, a balanced diet, and adequate sleep can also significantly improve symptoms. Social support is crucial, as maintaining meaningful connections can help combat the isolation often associated with anhedonia. If you or someone you know is struggling with anhedonia, seeking professional help is essential. Mental health resources, like those offered by Mpower in India, provide access to qualified therapists and psychiatrists who can offer tailored treatment plans. Addressing anhedonia early can lead to better outcomes and a return to a more fulfilling life.",
            catchy: "Finding pleasure in life again through insight, support, and healing.",
            writer : "anonymous",
            date : "Jun 2024"
        },
        {
            img: "/blog/child.jpg",
            title: "Supporting Your Child's Mental Health: Starting the Conversation",
            content : "Talking about mental health with your child can be uncomfortable and strange for both of you. As a parent, you might not know where to start or what to say. It's okay—this article offers tips to help you navigate these crucial conversations. The first step is to establish a safe and positive environment over time. Engage in activities your child enjoys, creating a relaxed atmosphere where they feel comfortable. During these moments, casually ask about their school, friends, teachers, interests, and how they feel about them. This approach helps set the stage for deeper conversations. Opening the door to sharing can be as simple as asking the right questions. Start with prompts that encourage your child to talk about themselves. Questions like What makes you happy, sad, angry, frustrated, worried, or scared? or  What do you do to make yourself feel better? can provide valuable insight into your child's emotional state. You might also ask them about their favorite book, show, or movie, and what they like most about themselves.If your child doesn’t open up to you, that's okay. Sometimes kids find it easier to talk to someone other than a parent. This could be another adult—such as a mentor, coach, relative, or religious leader. The important thing is that your child has someone they trust and feel comfortable sharing their feelings with. As a parent, it's crucial to be vigilant for any warning signs that may indicate your child is struggling with their mental health. These can include changes in school performance, substance use, alterations in sleeping or eating habits, increased anxiety, or withdrawal from activities they once loved. If you're unsure whether your child's behavior is a warning sign, consult a professional, such as a pediatrician, teacher, school counselor, or someone with mental health experience. When addressing these concerns with your child, it's essential to be direct but kind. Avoid making judgmental statements or assumptions about the cause of your child's distress. Instead, let your child know you're there to help and that they can tell you what they need. For instance, instead of saying, You'll be fine. Just get over it, you might say, Wow, that sounds difficult. I'm sorry you're going through that. I'm here for you. It's also important to stay connected with people in your child’s life who have experience with mental health concerns, such as a pediatrician, school counselor, or teacher. These individuals know you and your child well, and you won't have to support your child alone. If your child expresses suicidal thoughts, remain calm and listen non-judgmentally. Your priority is to keep your child safe. If they are in immediate danger, take them to an emergency room or a mental health crisis center. Professionals there are trained to handle the situation and can help you and your child develop a plan for ongoing support.",
            catchy: "Creating a safe space for open dialogue and early intervention.",
            writer : "anonymous",
            date : "Jun 2024"
        },
        {
            img: "/blog/exams.jpg",
            title: "Crushing Competitive Exams Without Crushing Your Soul: A Gen Z Guide to Mental Health",
            content : "Hey there, future world-changers! Let's talk about the elephant in the room – competitive exams and the rollercoaster of emotions that come with them. We know the drill: JEE, NEET, IIT... these acronyms can feel like they're defining our entire future. But here's the tea: your worth isn't measured by a test score, and your mental health matters way more than any exam. Let's be real – the competition is fierce out there. With parents dreaming of their kid becoming the next big doctor or engineer, media hyping up toppers like they're rockstars, and our own sky-high expectations, it's no wonder stress levels are through the roof. Kota, the coaching capital, has become synonymous with both success stories and heartbreaking headlines. But listen up: You are not alone in this struggle. When the pressure gets too much, it's not just about sweaty palms and racing hearts. We're talking about anxiety that makes you feel like you're starring in your own horror movie, depression that sucks the joy out of everything, even your favorite memes, and in extreme cases, thoughts that are way too dark and scary. These are serious issues, fam. And it's okay to admit you're not okay. Time to level up your self-care game. Get organized by creating a study schedule that doesn't make you want to cry. Take breaks - binge-watching your fave show isn't procrastination, it's self-care (in moderation, of course). Sleep is crucial; seriously, all-nighters are so last season. Eat well and fuel your brain with more than just instant noodles. Move that body - a dance break or a quick workout can be a total game-changer. And don't forget to talk it out - slide into your bestie's DMs or chat with a counselor. There's no shame in the mental health game! Remember, your journey is unique, and there's no one-size-fits-all approach to success. Whether you're aiming for IIT or exploring alternative paths, know that your mental health is the real MVP here. To all the parents, teachers, and mentors out there: Let's create a support system that celebrates effort, not just results. A little understanding goes a long way in reducing the pressure cooker environment. Competitive exams are just one chapter in your epic life story. They don't define you, and they certainly don't determine your worth. Take care of your mental health, surround yourself with positive vibes, and remember – you're capable of amazing things, exam or no exam. So, future doctors, engineers, artists, entrepreneurs, or whatever awesome path you choose – go out there and show the world what you're made of. But most importantly, be kind to yourself along the way. You've got this, and we're rooting for you!",
            catchy: "Ace your exams, not your mental health: Your guide to staying sane in the competitive exam chaos.",
            writer : "anonymous",
            date : "Jun 2024"
        },
    ];

    return (
        <>
            <div className={`p-4 bg-[#C6C1D8] ${isModalOpen ? 'blur-md' : ''}`}>
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 mb-10">
                    {blogs.map((blog, index) => (
                        <div
                            key={index}
                            onClick={() => openBlog(blog)}
                        >
                            <div className="relative mb-28">
                                <img src={blog.img} alt="img" className="z-0 w-full h-auto rounded-xl" />
                                <div className="mx-7 absolute -h-52 -bottom-24 left-0 z-10 bg-white shadow-md rounded-lg p-5 hover:shadow-xl transition-shadow cursor-pointer">
                                    <h2 className="text-xl font-semibold mb-2">{blog.title}</h2>
                                    <p className="text-gray-700">{blog.catchy}</p>
                                    <div className='text-right'>
                                        <p>- {blog.writer}</p>
                                        <p>{blog.date}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            {selectedBlog && (
                <div 
                    className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black transition-all duration-300 ${
                        isModalOpen ? 'bg-opacity-50' : 'bg-opacity-0 pointer-events-none'
                    }`}
                    onClick={closeModal}
                >
                    <div 
                        className={`bg-white rounded-lg w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto transition-all duration-300 ${
                            isModalOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
                        }`}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-6">
                            <h3 className="font-bold text-lg mb-4">{selectedBlog.title}</h3>
                            <p className="mb-6">{selectedBlog.content}</p>
                            <div className="text-right">
                                <button 
                                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors duration-300" 
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
}

export default Blogs;
