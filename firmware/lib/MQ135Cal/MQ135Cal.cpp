#include "MQ135Cal.h"

MQ135Cal::MQ135Cal(int pin, float r_load) {
  _pin = pin;
  _r_load = r_load;
  pinMode(_pin, INPUT);
}

float MQ135Cal::getResistance() {
  int raw = analogRead(_pin);
  float voltage = (raw / 4095.0) * 3.3;
  float rs = ((5.0 * _r_load) / voltage) - _r_load;
  return rs;
}

float MQ135Cal::getRatio(float r0) {
  return getResistance() / r0;
}

float MQ135Cal::getCorrectedRatio(float r0, float temp, float hum) {
  float ratio = getRatio(r0);
  float tempFactor = 1.0 + 0.02 * (temp - 20.0);
  float humFactor = 1.0 + 0.01 * (hum - 33.0);
  return ratio / (tempFactor * humFactor);
}

float MQ135Cal::getIAQ(float ratio) {
  // IAQ scale 0-500
  float iaq = 50.0 + (1.0 - ratio) * 200.0;
  return constrain(iaq, 10.0, 500.0);
}

float MQ135Cal::getCO2(float ratio) {
  // Power-law fit (example coefficients; calibrate for your sensor!)
  float a = 116.6020682;
  float b = -2.769034857;
  float ppm = a * pow(ratio, b);
  return constrain(ppm, 300.0, 5000.0);
}