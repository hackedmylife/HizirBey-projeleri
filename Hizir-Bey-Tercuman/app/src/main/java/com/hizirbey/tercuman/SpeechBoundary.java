package com.hizirbey.tercuman;

/** Short, bounded utterances. Energy gating is not speaker or music recognition. */
final class SpeechBoundary {
    static final int MAX_FRAMES=300, MAX_SAMPLES=MAX_FRAMES*320;
    private int frames,first=-1,last=-1,voiced,calibrationFrames;
    private double noise=0.0002,initialMinimum=Double.POSITIVE_INFINITY,peak;
    void accept(short[] samples,int count){
        double energy=0;for(int i=0;i<count;i++){double v=samples[i]/32768.0;energy+=v*v;}
        double rms=Math.sqrt(energy/Math.max(1,count));
        // Keep the audio during calibration; use its quietest frame, not the loudest.
        if(calibrationFrames++<12){initialMinimum=Math.min(initialMinimum,rms);noise=Math.max(0.00015,initialMinimum);}
        else if(first<0&&rms<noise*1.5)noise=0.98*noise+0.02*rms;
        peak=Math.max(rms,peak*0.98);
        double threshold=Math.max(0.0012,noise*1.8+0.0004);
        if(hasSpeech())threshold=Math.max(threshold,peak*0.22);
        if(rms>threshold){if(first<0)first=frames;last=frames;voiced++;}
        frames++;
    }
    SpeechBoundary nextChunk(){
        SpeechBoundary next=new SpeechBoundary();next.noise=noise;next.initialMinimum=initialMinimum;next.calibrationFrames=12;return next;
    }
    boolean hasSpeech(){return voiced>=8;}
    boolean finished(){return frames>=MAX_FRAMES||(hasSpeech()&&frames-last>=35);}
    int startSample(){return Math.max(0,(first-10)*320);}
    int endSample(int available){return Math.min(available,(last+15)*320);}
}
