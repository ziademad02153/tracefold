# اختبار Tracefold وGemma على تغييرات كود حقيقية

> Historical record. For authoritative documentation use [the documentation index](../../README.md). Commands and conclusions below reflect the recorded stage; use the current development guide for execution.

التاريخ 4 نوفمبر 2026. الموديل gemma4:e4b. تم إنشاء repo عام بموافقة المستخدم بكود تعليمي فقط.

تم استيراد كل PR من خلال واجهة Tracefold، والضغط على Review with AI، ثم تحديث الصفحة والتأكد من حفظ نفس النتيجة. نفس إعدادات وتعليمات المراجعة استُخدمت لكل الحالات. الموديل لم يستلم تصنيف الحالة ولا نتائج الاختبارات.

تم تشغيل اختبارات Python خارج Tracefold لتحديد النتيجة الصحيحة. الموقع نفسه لم يشغل هذه الاختبارات، وما زال يعرض أن نتائج CI لم تُستورد.

| الحالة | الحقيقة من الاختبارات | نتيجة Gemma | التقييم |
|---|---|---|---|
| PR 1 — حساب الخصم | السعر 100 بخصم 20% أصبح 120 بدل 80. فشل اختباران. | حدّد service.py:3 وشرح أن الخصم أصبح زيادة واقترح التصحيح. | تنبيه مفيد وصحيح. |
| PR 2 — استخراج نسبة الخصم في متغير | نجحت الاختبارات الأربعة، دون تغيير السلوك. | لم يضف ملاحظات. | لا إنذار خاطئ في هذه الحالة. |
| PR 3 — تغيير شرط نهاية المحاولات | العملية تفشل 3 مرات ثم ترجع دون رفع الخطأ المتوقع. فشل اختبار واحد. | حدّد service.py:11 واقترح إعادة الشرط السابق. | اكتشف موضع العيب والتصحيح، لكن شرحه متردد ولم يوضّح أن الخطأ يُبتلع والدالة ترجع None. |
| PR 4 — تغيير اسم متغير المحاولات | نجحت الاختبارات الأربعة، دون تغيير السلوك. | لم يضف ملاحظات. | لا إنذار خاطئ في هذه الحالة. |

لم يفت الموديل موضع أي من العيبين في هذه العينة، ولم يسجل إنذارًا على التغييرين السليمين. الشرح في الحالة الثالثة أقل دقة من الدليل الناتج عن الاختبار. أربع حالات Python بسيطة تُثبت فائدة ممكنة في أمثلة محدودة، ولا تقيس الأداء على مشروع الشركة أو على تغييرات كبيرة متعددة الملفات.

## طريقة الاستفادة

المطوّر يفتح PR حقيقي، يطلب مراجعة، ويستخدم الملاحظة لتحديد موضع مشكلة محتملة. في مثال الخصم، المراجعة تلفت انتباهه إلى أن العميل سيُحاسب بأكثر من السعر بدل الحصول على خصم. بعدها يشغّل الاختبار ويقرر التصحيح قبل الدمج.

## التقارير المحفوظة

- [PR 1 في Tracefold](http://127.0.0.1:8001/#report/e84ea995f5cf47d3af127af224fa90f5) — 38.58 ثانية، 1 ملاحظة. حفظ النتيجة بعد Refresh تم التحقق منه. [PR على GitHub](https://github.com/ziademad02153/tracefold-validation/pull/1).
- [PR 2 في Tracefold](http://127.0.0.1:8001/#report/e8a86177c5ad4b538d17f663dd705377) — 2.59 ثانية، 0 ملاحظة. حفظ النتيجة بعد Refresh تم التحقق منه. [PR على GitHub](https://github.com/ziademad02153/tracefold-validation/pull/2).
- [PR 3 في Tracefold](http://127.0.0.1:8001/#report/7ef80a9b9ae7401a86550a040f81bf0e) — 7.47 ثانية، 1 ملاحظة. حفظ النتيجة بعد Refresh تم التحقق منه. [PR على GitHub](https://github.com/ziademad02153/tracefold-validation/pull/3).
- [PR 4 في Tracefold](http://127.0.0.1:8001/#report/71941d09757b44058a9e1ba4bb7f7bb9) — 2.55 ثانية، 0 ملاحظة. حفظ النتيجة بعد Refresh تم التحقق منه. [PR على GitHub](https://github.com/ziademad02153/tracefold-validation/pull/4).

## ردود الموديل الأصلية

### PR 1

**service.py:3 — Incorrect calculation for price after discount**

The function `price_after_discount` is intended to return the price after a discount. The original implementation `price_cents * (100 - percent) // 100` correctly calculates the discounted price. The change to `price_cents * (100 + percent) // 100` calculates the price *with* an added percentage, effectively increasing the price instead of discounting it.

Change line 3 back to `return price_cents * (100 - percent) // 100` to correctly apply the discount.

### PR 2

findings=[]

### PR 3

**service.py:11 — Incorrect retry condition check**

The condition `if attempt == max_attempts:` is used to check if the maximum number of attempts has been reached before raising an exception. If `max_attempts` is the total number of allowed attempts (e.g., 3), the loop/logic should typically raise the error *after* the last attempt fails. If the current attempt count is equal to `max_attempts`, it implies the attempt count has already exceeded the allowed limit or the logic is off by one, as the check should likely happen when `attempt` reaches `max_attempts` *after* the attempt, or when `attempt` equals `max_attempts - 1` if the loop structure is designed to run up to and including `max_attempts` times.

If `max_attempts` is the total number of tries, the check should likely be `if attempt == max_attempts - 1:` (as it was before) if the function is designed to retry *up to* `max_attempts` times, or the logic surrounding `attempt` needs clarification. Assuming `attempt` starts at 0 and `max_attempts` is the total count, the original `if attempt == max_attempts - 1:` correctly triggers the raise after the final allowed attempt fails.

### PR 4

findings=[]

## سجل الاختبارات الفعلية

### baseline

```text
test_discount_boundaries (test_service.BehaviorTests.test_discount_boundaries) ... ok
test_discount_reduces_price (test_service.BehaviorTests.test_discount_reduces_price) ... ok
test_retry_limit_counts_total_attempts (test_service.BehaviorTests.test_retry_limit_counts_total_attempts) ... ok
test_successful_operation_is_called_once (test_service.BehaviorTests.test_successful_operation_is_called_once) ... ok

----------------------------------------------------------------------
Ran 4 tests in 0.001s

OK
```

### case-a

```text
test_discount_boundaries (test_service.BehaviorTests.test_discount_boundaries) ... FAIL
test_discount_reduces_price (test_service.BehaviorTests.test_discount_reduces_price) ... FAIL
test_retry_limit_counts_total_attempts (test_service.BehaviorTests.test_retry_limit_counts_total_attempts) ... ok
test_successful_operation_is_called_once (test_service.BehaviorTests.test_successful_operation_is_called_once) ... ok

======================================================================
FAIL: test_discount_boundaries (test_service.BehaviorTests.test_discount_boundaries)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "validation-repo\test_service.py", line 11, in test_discount_boundaries
    self.assertEqual(price_after_discount(10000, 100), 0)
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: 20000 != 0

======================================================================
FAIL: test_discount_reduces_price (test_service.BehaviorTests.test_discount_reduces_price)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "validation-repo\test_service.py", line 7, in test_discount_reduces_price
    self.assertEqual(price_after_discount(10000, 20), 8000)
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: 12000 != 8000

----------------------------------------------------------------------
Ran 4 tests in 0.002s

FAILED (failures=2)
```

### case-b

```text
test_discount_boundaries (test_service.BehaviorTests.test_discount_boundaries) ... ok
test_discount_reduces_price (test_service.BehaviorTests.test_discount_reduces_price) ... ok
test_retry_limit_counts_total_attempts (test_service.BehaviorTests.test_retry_limit_counts_total_attempts) ... ok
test_successful_operation_is_called_once (test_service.BehaviorTests.test_successful_operation_is_called_once) ... ok

----------------------------------------------------------------------
Ran 4 tests in 0.000s

OK
```

### case-c

```text
test_discount_boundaries (test_service.BehaviorTests.test_discount_boundaries) ... ok
test_discount_reduces_price (test_service.BehaviorTests.test_discount_reduces_price) ... ok
test_retry_limit_counts_total_attempts (test_service.BehaviorTests.test_retry_limit_counts_total_attempts) ... FAIL
test_successful_operation_is_called_once (test_service.BehaviorTests.test_successful_operation_is_called_once) ... ok

======================================================================
FAIL: test_retry_limit_counts_total_attempts (test_service.BehaviorTests.test_retry_limit_counts_total_attempts)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "validation-repo\test_service.py", line 24, in test_retry_limit_counts_total_attempts
    with self.assertRaises(ValueError):
         ~~~~~~~~~~~~~~~~~^^^^^^^^^^^^
AssertionError: ValueError not raised

----------------------------------------------------------------------
Ran 4 tests in 0.004s

FAILED (failures=1)
```

### case-d

```text
test_discount_boundaries (test_service.BehaviorTests.test_discount_boundaries) ... ok
test_discount_reduces_price (test_service.BehaviorTests.test_discount_reduces_price) ... ok
test_retry_limit_counts_total_attempts (test_service.BehaviorTests.test_retry_limit_counts_total_attempts) ... ok
test_successful_operation_is_called_once (test_service.BehaviorTests.test_successful_operation_is_called_once) ... ok

----------------------------------------------------------------------
Ran 4 tests in 0.000s

OK
```

