package com.hizirbey.tercuman;
/** Small synthesis requests reduce time to the first audible phrase. */
final class SpeechChunks {
    static int end(String text,int limit,boolean fast){
        int end=Math.min(text.length(),Math.min(limit,fast?160:limit));
        if(fast){for(int i=20;i<end;i++){char c=text.charAt(i);if((c=='.'||c=='!'||c=='?'||c=='\n')&&(i+1==text.length()||Character.isWhitespace(text.charAt(i+1)))){end=i+1;break;}}}
        if(end<text.length()&&!Character.isWhitespace(text.charAt(end))){int word=text.lastIndexOf(' ',end-1);if(word>end/2)end=word;}
        if(end>0&&end<text.length()&&Character.isHighSurrogate(text.charAt(end-1)))end--;
        return Math.max(1,end);
    }
}
