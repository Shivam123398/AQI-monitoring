#ifndef MQ135CAL_H
#define MQ135CAL_H

#include <Arduino.h>

class MQ135Cal {
public:
  MQ135Cal(int pin, float r_load);
  float getResistance();
  float getRatio(float r0);
  float getCorrectedRatio(float r0, float temp, float hum);
  float getIAQ(float ratio);
  float getCO2(float ratio);
  
private:
  int _pin;
  float _r_load;
};

#endif
