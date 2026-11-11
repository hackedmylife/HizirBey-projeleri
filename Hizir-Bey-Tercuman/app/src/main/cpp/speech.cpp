#include <jni.h>
#include <atomic>
#include <string>
#include <vector>
#include <algorithm>
#include "whisper.h"

struct Context { whisper_context * whisper; std::atomic<bool> cancelled{false}; };
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
    auto params=whisper_full_default_params(WHISPER_SAMPLING_GREEDY);
    params.n_threads=std::max(1,std::min(4,static_cast<int>(threads)));
    params.language=code.c_str();params.translate=false;params.detect_language=false;
    params.no_context=true;params.no_timestamps=true;params.single_segment=false;
    params.print_special=false;params.print_progress=false;params.print_realtime=false;params.print_timestamps=false;
    params.suppress_nst=true;params.temperature=0;params.temperature_inc=0;
    params.greedy.best_of=1;params.abort_callback=aborted;params.abort_callback_user_data=c;
    const int result=whisper_full(c->whisper,params,pcm.data(),length);
    if(c->cancelled.load())return env->NewByteArray(0);
    if(result!=0){error(env,"Konuşma yerel motorda çözümlenemedi.");return nullptr;}
    std::string text;
    for(int i=0;i<whisper_full_n_segments(c->whisper);i++)text+=whisper_full_get_segment_text(c->whisper,i);
    jbyteArray out=env->NewByteArray(static_cast<jsize>(text.size()));
    env->SetByteArrayRegion(out,0,static_cast<jsize>(text.size()),reinterpret_cast<const jbyte *>(text.data()));return out;
}
extern "C" JNIEXPORT void JNICALL
Java_com_hizirbey_tercuman_NativeWhisper_destroy(JNIEnv *,jclass,jlong address) {
    auto * c=reinterpret_cast<Context *>(address);if(c){whisper_free(c->whisper);delete c;}
}
