import React from 'react';

export const DecorativeBackground: React.FC = () => (
  <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
    {/* Large soft filled circles */}
    <div className="absolute -top-10 -left-16 w-80 h-80 sm:w-[28rem] sm:h-[28rem] rounded-full bg-primary/[0.03]" />
    <div className="absolute top-48 right-0 w-64 h-64 sm:w-96 sm:h-96 rounded-full bg-primary/[0.025]" />
    <div className="absolute top-[30rem] left-[10%] w-72 h-72 sm:w-[22rem] sm:h-[22rem] rounded-full bg-secondary/[0.025]" />
    <div className="absolute top-[55rem] right-[15%] w-56 h-56 sm:w-80 sm:h-80 rounded-full bg-primary/[0.02]" />
    <div className="absolute bottom-40 -left-10 w-60 h-60 sm:w-[20rem] sm:h-[20rem] rounded-full bg-primary/[0.025]" />
    <div className="absolute bottom-10 right-[5%] w-48 h-48 sm:w-72 sm:h-72 rounded-full bg-secondary/[0.02]" />

    {/* Ring-style circles */}
    <div className="absolute top-12 left-[8%] w-28 h-28 sm:w-44 sm:h-44 rounded-full border border-primary/[0.05]" />
    <div className="absolute top-[22rem] right-[5%] w-36 h-36 sm:w-52 sm:h-52 rounded-full border border-secondary/[0.05]" />
    <div className="absolute top-[50rem] left-[20%] w-32 h-32 sm:w-48 sm:h-48 rounded-full border border-primary/[0.04]" />
    <div className="absolute bottom-32 right-[25%] w-24 h-24 sm:w-36 sm:h-36 rounded-full border border-primary/[0.04]" />

    {/* Small decorative dots */}
    <div className="absolute top-28 right-[20%] w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-primary/[0.08]" />
    <div className="absolute top-40 left-[30%] w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-secondary/[0.08]" />
    <div className="absolute top-[35rem] right-[40%] w-3 h-3 sm:w-5 sm:h-5 rounded-full bg-primary/[0.06]" />
    <div className="absolute top-[60rem] left-[50%] w-2.5 h-2.5 sm:w-4 sm:h-4 rounded-full bg-secondary/[0.07]" />
    <div className="absolute bottom-60 left-[15%] w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-primary/[0.08]" />
    <div className="absolute top-[18rem] left-[60%] w-2 h-2 rounded-full bg-primary/[0.06]" />
    <div className="absolute bottom-40 right-[35%] w-1.5 h-1.5 sm:w-2.5 sm:h-2.5 rounded-full bg-secondary/[0.07]" />
  </div>
);
