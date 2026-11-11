#include <jni.h>
#include <atomic>
#include <string>
#include <vector>
#include <algorithm>
#include "whisper.h"

struct Context { whisper_context * whisper; whisper_vad_context * vad=nullptr; bool fast=false; std::atomic<bool> cancelled{false}; };
static bool aborted(void * data) { return static_cast<Context *>(data)->cancelled.load(); }
static void error(JNIEnv * env,const char * message) {
    env->ThrowNew(env->FindClass("java/lang/IllegalStateException"),message);
}
extern "C" JNIEXPORT jlong JNICALL
Java_com_hizirbey_tercuman_NativeWhisper_create(JNIEnv *env,jclass,jstring path) {
    const char * p=env->GetStringUTFChars(path,nullptr);
    auto options=whisper_context_default_params();options.use_gpu=false;
    auto * model=whisper_init_from_file_with_params(p,options);
    env->ReleaseStringUTFChars(path,p);
    if(!model){error(env,"Yerel konuşma modeli açılamadı.");return 0;}
    return reinterpret_cast<jlong>(new Context{model});
}
extern "C" JNIEXPORT void JNICALL
Java_com_hizirbey_tercuman_NativeWhisper_configureVad(JNIEnv *env,jclass,jlong address,jstring path) {
    auto * c=reinterpret_cast<Context *>(address);
    if(!c||!path){error(env,"Konuşma etkinliği modeli hazırlanamadı.");return;}
    if(c->vad)return;
    const char * p=env->GetStringUTFChars(path,nullptr);
    auto options=whisper_vad_default_context_params();options.use_gpu=false;options.n_threads=2;
    c->vad=whisper_vad_init_from_file_with_params(p,options);env->ReleaseStringUTFChars(path,p);
    if(!c->vad)error(env,"Konuşma etkinliği modeli açılamadı.");
}
extern "C" JNIEXPORT void JNICALL
Java_com_hizirbey_tercuman_NativeWhisper_configureFast(JNIEnv *,jclass,jlong address,jboolean fast) {
    if(address)reinterpret_cast<Context *>(address)->fast=fast;
}
extern "C" JNIEXPORT jboolean JNICALL
Java_com_hizirbey_tercuman_NativeWhisper_hasSpeech(JNIEnv *env,jclass,jlong address,jfloatArray samples) {
    auto * c=reinterpret_cast<Context *>(address);if(!c||c->cancelled.load()||!c->vad)return false;
    int n=env->GetArrayLength(samples);std::vector<float> pcm(n);env->GetFloatArrayRegion(samples,0,n,pcm.data());
    auto params=whisper_vad_default_params();params.threshold=0.5f;params.min_speech_duration_ms=100;
    auto * segments=whisper_vad_segments_from_samples(c->vad,params,pcm.data(),n);if(!segments)return false;
    bool speech=whisper_vad_segments_n_segments(segments)>0;whisper_vad_free_segments(segments);return speech&&!c->cancelled.load();
}
extern "C" JNIEXPORT void JNICALL
Java_com_hizirbey_tercuman_NativeWhisper_cancel(JNIEnv *,jclass,jlong address) {
    if(address)reinterpret_cast<Context *>(address)->cancelled.store(true);
}
extern "C" JNIEXPORT void JNICALL
Java_com_hizirbey_tercuman_NativeWhisper_reset(JNIEnv *,jclass,jlong address) {
    if(address)reinterpret_cast<Context *>(address)->cancelled.store(false);
}
extern "C" JNIEXPORT jbyteArray JNICALL
Java_com_hizirbey_tercuman_NativeWhisper_transcribe(JNIEnv *env,jclass,jlong address,jfloatArray samples,jstring language,jint threads) {
    auto * c=reinterpret_cast<Context *>(address);
    if(!c||c->cancelled.load())return env->NewByteArray(0);
    const char * lang=env->GetStringUTFChars(language,nullptr);std::string code(lang);env->ReleaseStringUTFChars(language,lang);
    if(whisper_lang_id(code.c_str())<0){error(env,"Bu dil yerel konuşma motorunda desteklenmiyor.");return nullptr;}
    const auto length=env->GetArrayLength(samples);std::vector<float> pcm(length);
    env->GetFloatArrayRegion(samples,0,length,pcm.data());
    // Reject non-speech acoustically. No word blacklist or trailing-word deletion.
    if(c->vad){
        auto gate=whisper_vad_default_params();gate.threshold=0.5f;gate.min_speech_duration_ms=100;
        gate.min_silence_duration_ms=100;gate.speech_pad_ms=150;gate.samples_overlap=0;
        auto * segments=whisper_vad_segments_from_samples(c->vad,gate,pcm.data(),length);
        if(!segments){error(env,"Konuşma etkinliği çözümlenemedi.");return nullptr;}
        std::vector<float> voiced;voiced.reserve(length);
        const int count=whisper_vad_segments_n_segments(segments);
        for(int i=0;i<count;i++){
            int start=std::max(0,std::min(static_cast<int>(length),static_cast<int>(whisper_vad_segments_get_segment_t0(segments,i)*160)));
            int end=std::max(start,std::min(static_cast<int>(length),static_cast<int>(whisper_vad_segments_get_segment_t1(segments,i)*160)));
            if(end<=start)continue;
            if(!voiced.empty())voiced.insert(voiced.end(),1600,0.0f);
            voiced.insert(voiced.end(),pcm.begin()+start,pcm.begin()+end);
        }
        whisper_vad_free_segments(segments);
        if(voiced.empty()||c->cancelled.load())return env->NewByteArray(0);
        pcm.swap(voiced);
    }
    auto params=whisper_full_default_params(WHISPER_SAMPLING_GREEDY);
    params.n_threads=std::max(1,std::min(4,static_cast<int>(threads)));
    params.language=code.c_str();params.translate=false;params.detect_language=false;
    params.no_context=true;params.no_timestamps=true;params.single_segment=false;
    params.print_special=false;params.print_progress=false;params.print_realtime=false;params.print_timestamps=false;
    // Short conversation chunks do not need the full 30-second encoder window.
    if(c->fast){int needed=static_cast<int>((pcm.size()+319)/320)+128;
        params.audio_ctx=std::min(whisper_n_audio_ctx(c->whisper),std::max(768,((needed+63)/64)*64));}
    params.suppress_nst=true;params.temperature=0;params.temperature_inc=0;
    params.greedy.best_of=1;params.abort_callback=aborted;params.abort_callback_user_data=c;
    const int result=whisper_full(c->whisper,params,pcm.data(),static_cast<int>(pcm.size()));
    if(c->cancelled.load())return env->NewByteArray(0);
    if(result!=0){error(env,"Konuşma yerel motorda çözümlenemedi.");return nullptr;}
    std::string text;
    for(int i=0;i<whisper_full_n_segments(c->whisper);i++)text+=whisper_full_get_segment_text(c->whisper,i);
    jbyteArray out=env->NewByteArray(static_cast<jsize>(text.size()));
    env->SetByteArrayRegion(out,0,static_cast<jsize>(text.size()),reinterpret_cast<const jbyte *>(text.data()));return out;
}
extern "C" JNIEXPORT void JNICALL
Java_com_hizirbey_tercuman_NativeWhisper_destroy(JNIEnv *,jclass,jlong address) {
    auto * c=reinterpret_cast<Context *>(address);if(c){if(c->vad)whisper_vad_free(c->vad);whisper_free(c->whisper);delete c;}
}
