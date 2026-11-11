package com.hizirbey.tercuman;

/** 20 ms PCM frames; require actual voice energy before allowing inference. */
final class SpeechBoundary {
    private int frames,first=-1,last=-1,voiced;
    private double noise=0.002;
    void accept(short[] samples,int count){
        double energy=0;for(int i=0;i<count;i++){double v=samples[i]/32768.0;energy+=v*v;}
        double rms=Math.sqrt(energy/Math.max(1,count));
        if(first<0&&rms<0.012)noise=0.95*noise+0.05*rms;
        if(rms>Math.max(0.008,Math.min(0.04,noise*3.0))){if(first<0)first=frames;last=frames;voiced++;}
        frames++;
    }
    boolean hasSpeech(){return voiced>=8;}
    boolean finished(){return frames>=1000||(first<0&&frames>=400)||(hasSpeech()&&frames-last>=60);}
    int startSample(){return Math.max(0,(first-10)*320);}
    int endSample(int available){return Math.min(available,(last+15)*320);}
}
