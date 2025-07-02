import React, { useContext, useEffect } from 'react';
import { DeckContext, SlideContext } from 'spectacle';

// Example component showing how to track slide navigation
export const SlideTrackingExample: React.FC = () => {
  const deckContext = useContext(DeckContext);
  const slideContext = useContext(SlideContext);

  // Access current slide information from DeckContext
  const { activeView, pendingView, slideCount } = deckContext;
  
  // Access slide-specific information from SlideContext
  const { isSlideActive, activeStepIndex, slideId } = slideContext;

  useEffect(() => {
    console.log('Deck State:', {
      currentSlideIndex: activeView.slideIndex,
      currentSlideId: activeView.slideId,
      currentStepIndex: activeView.stepIndex,
      totalSlides: slideCount,
      isTransitioning: pendingView.slideId !== activeView.slideId
    });
  }, [activeView, pendingView, slideCount]);

  useEffect(() => {
    console.log('Slide State:', {
      slideId,
      isActive: isSlideActive,
      stepIndex: activeStepIndex
    });
  }, [slideId, isSlideActive, activeStepIndex]);

  return (
    <div>
      <p>Current Slide: {activeView.slideIndex + 1} of {slideCount}</p>
      <p>Current Step: {activeView.stepIndex + 1}</p>
      {pendingView.slideId !== activeView.slideId && (
        <p>Transitioning to slide {pendingView.slideIndex + 1}...</p>
      )}
    </div>
  );
};

// Example hook for tracking slide changes
export const useSlideChangeEffect = (callback: (oldSlide: number, newSlide: number) => void) => {
  const { activeView } = useContext(DeckContext);
  const previousSlideRef = React.useRef(activeView.slideIndex);

  useEffect(() => {
    if (previousSlideRef.current !== activeView.slideIndex) {
      callback(previousSlideRef.current, activeView.slideIndex);
      previousSlideRef.current = activeView.slideIndex;
    }
  }, [activeView.slideIndex, callback]);
};

// Example component that disposes resources on slide change
export const ResourceManagedComponent: React.FC = () => {
  const { isSlideActive } = useContext(SlideContext);
  const resourceRef = React.useRef<any>(null);

  useEffect(() => {
    if (isSlideActive) {
      // Initialize resources when slide becomes active
      console.log('Slide became active, initializing resources...');
      resourceRef.current = {
        // Your resource initialization here
        data: 'Some expensive resource'
      };
    } else {
      // Dispose resources when slide becomes inactive
      console.log('Slide became inactive, disposing resources...');
      if (resourceRef.current) {
        // Your cleanup logic here
        resourceRef.current = null;
      }
    }
  }, [isSlideActive]);

  return (
    <div>
      {isSlideActive ? 'Resources loaded' : 'Resources disposed'}
    </div>
  );
};