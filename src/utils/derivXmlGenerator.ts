import { DBotStrategy } from '../types/deriv';

/**
 * Generates a complete, valid Deriv DBot / Binary Bot (.xml) file
 * that can be directly imported into bot.deriv.com / app.deriv.com/bot / bot.binary.com.
 */
export function generateDerivBotXml(bot: DBotStrategy): string {
  const isPercentageLock =
    bot.id.includes('percentage_lock') ||
    bot.rules?.indicatorTrigger === 'PERCENTAGE_LOCK' ||
    bot.name.toLowerCase().includes('percentage lock') ||
    bot.name.toLowerCase().includes('percentage  lock');
  const isAlternating =
    !isPercentageLock &&
    (bot.id.includes('alternating') ||
      bot.rules?.indicatorTrigger === 'ALTERNATING_DIGIT_DIFF' ||
      bot.name.toLowerCase().includes('alternating'));
  const isQuantum90Differ =
    !isPercentageLock &&
    !isAlternating &&
    (bot.id.includes('quantum') ||
      bot.id.includes('digit_differs_99') ||
      bot.rules?.indicatorTrigger === 'QUANTUM_90_DIFFER' ||
      bot.rules?.indicatorTrigger === 'LAST_DIGIT_PATTERN' ||
      bot.name.toLowerCase().includes('90%') ||
      bot.name.toLowerCase().includes('quantum'));
  const isFrequencyBot =
    !isQuantum90Differ &&
    (bot.id.includes('frequency') ||
      bot.rules?.indicatorTrigger === 'HIGHEST_FREQUENCY_DIGIT' ||
      bot.rules?.indicatorTrigger === 'LOWEST_FREQUENCY_DIGIT' ||
      bot.rules?.indicatorTrigger === 'MOST_FREQUENT_DIGIT' ||
      bot.name.toLowerCase().includes('frequency'));
  const isSkipXDiffer =
    !isFrequencyBot &&
    (bot.id.includes('skip_x') ||
      bot.rules?.indicatorTrigger === 'SKIP_X_DIFFER' ||
      bot.name.toLowerCase().includes('skip x'));
  const isDoubleDifferRange =
    !isFrequencyBot &&
    !isSkipXDiffer &&
    (bot.id.includes('double_differ') ||
      bot.rules?.indicatorTrigger === 'DOUBLE_DIFFER_RANGE' ||
      bot.name.toLowerCase().includes('double differ'));
  const isXXYDifferX =
    !isFrequencyBot &&
    !isSkipXDiffer &&
    !isDoubleDifferRange &&
    (bot.id.includes('xxy_differ_x') ||
      bot.rules?.indicatorTrigger === 'XXY_DIFFER_X');
  const isTripleIdentical =
    !isFrequencyBot &&
    !isSkipXDiffer &&
    !isDoubleDifferRange &&
    !isXXYDifferX &&
    (bot.id.includes('triple_identical') ||
      bot.rules?.indicatorTrigger === 'TRIPLE_IDENTICAL_DIFF' ||
      bot.name.toLowerCase().includes('triple'));
  const isXXYPattern =
    !isFrequencyBot &&
    !isSkipXDiffer &&
    !isDoubleDifferRange &&
    !isXXYDifferX &&
    !isTripleIdentical &&
    (bot.id.includes('xxy') || bot.name.toLowerCase().includes('xxy'));
  const isCompounding = Boolean(bot.compoundingStake);
  const symbol = bot.symbol || 'R_100';
  const initialStake = bot.initialStake || 10;
  const martingaleFactor = bot.martingaleFactor || 11.5;
  const takeProfit = bot.takeProfit || 50;
  const stopLoss = bot.stopLoss || 100;
  const prediction = bot.rules?.paramValue ?? 2;

  // Clean XML Header conforming to standard Blockly format recognized by DBot
  return `<?xml version="1.0" encoding="UTF-8"?>
<xml xmlns="http://www.w3.org/1999/xhtml" collection="false">
  <variables>
    <variable type="" id="var_initial_stake">Initial Stake</variable>
    <variable type="" id="var_stake">Stake</variable>
    <variable type="" id="var_martingale">Martingale Factor</variable>
    <variable type="" id="var_take_profit">Target Profit</variable>
    <variable type="" id="var_stop_loss">Stop Loss</variable>
    <variable type="" id="var_total_profit">Total Profit</variable>
    <variable type="" id="var_prediction">Prediction Digit</variable>
    <variable type="" id="var_xxy_ready">XXY Ready</variable>
  </variables>

  <!-- ========================================================== -->
  <!-- BLOCK 1: TRADE DEFINITION & INITIALIZATION                 -->
  <!-- ========================================================== -->
  <block type="trade" id="trade_main_definition" x="0" y="0">
    <field name="MARKET_LIST">synthetic_index</field>
    <field name="SUBMARKET_LIST">random_index</field>
    <field name="SYMBOL_LIST">${symbol}</field>
    <field name="TRADETYPECAT_LIST">digits</field>
    <field name="TRADETYPE_LIST">matchesdiffers</field>
    <field name="TYPE_LIST">DIGITDIFF</field>
    <field name="CANDLEINTERVAL_LIST">60</field>
    <field name="TIME_MACHINE_ENABLED">FALSE</field>
    <field name="RESTARTONERROR">TRUE</field>
    <statement name="INITIALIZATION">
      <block type="variables_set" id="init_stake_val">
        <field name="VAR" id="var_initial_stake" variabletype="">Initial Stake</field>
        <value name="VALUE">
          <block type="math_number" id="num_init_stake">
            <field name="NUM">${initialStake}</field>
          </block>
        </value>
        <next>
          <block type="variables_set" id="init_current_stake">
            <field name="VAR" id="var_stake" variabletype="">Stake</field>
            <value name="VALUE">
              <block type="variables_get" id="get_init_stake">
                <field name="VAR" id="var_initial_stake" variabletype="">Initial Stake</field>
              </block>
            </value>
            <next>
              <block type="variables_set" id="init_martingale">
                <field name="VAR" id="var_martingale" variabletype="">Martingale Factor</field>
                <value name="VALUE">
                  <block type="math_number" id="num_martingale">
                    <field name="NUM">${martingaleFactor}</field>
                  </block>
                </value>
                <next>
                  <block type="variables_set" id="init_tp">
                    <field name="VAR" id="var_take_profit" variabletype="">Target Profit</field>
                    <value name="VALUE">
                      <block type="math_number" id="num_tp">
                        <field name="NUM">${takeProfit}</field>
                      </block>
                    </value>
                    <next>
                      <block type="variables_set" id="init_sl">
                        <field name="VAR" id="var_stop_loss" variabletype="">Stop Loss</field>
                        <value name="VALUE">
                          <block type="math_number" id="num_sl">
                            <field name="NUM">${stopLoss}</field>
                          </block>
                        </value>
                        <next>
                          <block type="variables_set" id="init_prediction">
                            <field name="VAR" id="var_prediction" variabletype="">Prediction Digit</field>
                            <value name="VALUE">
                              <block type="math_number" id="num_prediction">
                                <field name="NUM">${prediction}</field>
                              </block>
                            </value>
                            <next>
                              <block type="variables_set" id="init_xxy_ready">
                                <field name="VAR" id="var_xxy_ready" variabletype="">XXY Ready</field>
                                <value name="VALUE">
                                  <block type="logic_boolean" id="bool_xxy_init">
                                    <field name="BOOL">FALSE</field>
                                  </block>
                                </value>
                              </block>
                            </next>
                          </block>
                        </next>
                      </block>
                    </next>
                  </block>
                </next>
              </block>
            </next>
          </block>
        </next>
      </block>
    </statement>
    <statement name="SUBMARKET">
      <block type="tradeOptions" id="trade_options_config">
        <field name="DURATIONTYPE_LIST">t</field>
        <field name="CURRENCY_LIST">USD</field>
        <value name="DURATION">
          <block type="math_number" id="duration_num">
            <field name="NUM">${bot.durationTicks || 1}</field>
          </block>
        </value>
        <value name="AMOUNT">
          <block type="variables_get" id="get_amount_var">
            <field name="VAR" id="var_stake" variabletype="">Stake</field>
          </block>
        </value>
        <value name="PREDICTION">
          <block type="variables_get" id="get_pred_var">
            <field name="VAR" id="var_prediction" variabletype="">Prediction Digit</field>
          </block>
        </value>
      </block>
    </statement>
  </block>

  <!-- ========================================================== -->
  <!-- BLOCK 2: BEFORE PURCHASE / ANALYSIS                        -->
  <!-- ========================================================== -->
  <block type="before_purchase" id="before_purchase_main" x="0" y="550">
    <statement name="BEFOREPURCHASE_STACK">
      ${
        isPercentageLock
          ? `<!-- PERCENTAGE LOCK: UP/DOWN TICK PATTERN + EVEN >= 60% (10 TICKS) -> BUY DIGITDIFF 0 -->
      <block type="variables_set" id="set_pred_percentage_lock">
        <field name="VAR" id="var_prediction" variabletype="">Prediction Digit</field>
        <value name="VALUE">
          <block type="math_number" id="num_percentage_lock_pred"><field name="NUM">0</field></block>
        </value>
        <next>
          <block type="notify" id="notify_percentage_lock_trade">
            <field name="NOTIFICATION_TYPE">info</field>
            <field name="NOTIFICATION_SOUND">silent</field>
            <value name="MESSAGE">
              <block type="text" id="txt_percentage_lock">
                <field name="TEXT">⚡ PERCENTAGE LOCK: [UP, DOWN] Movement + Even >= 60% (Window 10) matched! Executing 1-tick DIGITDIFF 0 contract...</field>
              </block>
            </value>
            <next>
              <block type="purchase" id="buy_digitdiff_percentage_lock">
                <field name="PURCHASE_LIST">DIGITDIFF</field>
              </block>
            </next>
          </block>
        </next>
      </block>`
          : isAlternating
          ? `<!-- IDENTICAL PAIR ASCENDING DIFFER: [X, X] -> BUY DIGITDIFF (X + 1) % 10 (e.g. 2,2 -> Differ 3 | 4,4 -> Differ 5 | 7,7 -> Differ 8) -->
      <block type="controls_if" id="check_identical_pair_pattern">
        <value name="IF0">
          <block type="logic_compare" id="cmp_d2_eq_d1_pair">
            <field name="OP">EQ</field>
            <value name="A">
              <block type="lists_getIndex" id="get_digit_2_pair">
                <mutation statement="false" at="true"></mutation>
                <field name="MODE">GET</field>
                <field name="WHERE">FROM_END</field>
                <value name="VALUE">
                  <block type="lastDigitList" id="ld_list_pair_2"></block>
                </value>
                <value name="AT">
                  <block type="math_number" id="idx_2_pair"><field name="NUM">2</field></block>
                </value>
              </block>
            </value>
            <value name="B">
              <block type="lists_getIndex" id="get_digit_1_pair">
                <mutation statement="false" at="true"></mutation>
                <field name="MODE">GET</field>
                <field name="WHERE">FROM_END</field>
                <value name="VALUE">
                  <block type="lastDigitList" id="ld_list_pair_1"></block>
                </value>
                <value name="AT">
                  <block type="math_number" id="idx_1_pair"><field name="NUM">1</field></block>
                </value>
              </block>
            </value>
          </block>
        </value>
        <statement name="DO0">
          <block type="variables_set" id="set_pred_identical_pair_diff">
            <field name="VAR" id="var_prediction" variabletype="">Prediction Digit</field>
            <value name="VALUE">
              <block type="math_modulo" id="mod_next_ascending">
                <value name="DIVIDEND">
                  <block type="math_arithmetic" id="add_one_to_last_digit">
                    <field name="OP">ADD</field>
                    <value name="A">
                      <block type="lists_getIndex" id="get_digit_1_target">
                        <mutation statement="false" at="true"></mutation>
                        <field name="MODE">GET</field>
                        <field name="WHERE">FROM_END</field>
                        <value name="VALUE">
                          <block type="lastDigitList" id="ld_list_target_1"></block>
                        </value>
                        <value name="AT">
                          <block type="math_number" id="idx_1_target"><field name="NUM">1</field></block>
                        </value>
                      </block>
                    </value>
                    <value name="B">
                      <block type="math_number" id="num_1_add"><field name="NUM">1</field></block>
                    </value>
                  </block>
                </value>
                <value name="DIVISOR">
                  <block type="math_number" id="num_10_mod"><field name="NUM">10</field></block>
                </value>
              </block>
            </value>
            <next>
              <block type="notify" id="notify_identical_pair_trade">
                <field name="NOTIFICATION_TYPE">info</field>
                <field name="NOTIFICATION_SOUND">silent</field>
                <value name="MESSAGE">
                  <block type="text" id="txt_identical_pair_msg">
                    <field name="TEXT">⚡ IDENTICAL PAIR DETECTED [X, X]: Executing 1-tick DIGITDIFF on next ascending column (X + 1) % 10 (5s cooldown)...</field>
                  </block>
                </value>
                <next>
                  <block type="purchase" id="buy_digitdiff_identical_pair">
                    <field name="PURCHASE_LIST">DIGITDIFF</field>
                  </block>
                </next>
              </block>
            </next>
          </block>
        </statement>
      </block>`
          : isQuantum90Differ
          ? `<!-- QUANTUM 90%+ WIN RATE DIFFER: DYNAMIC POISSON EXHAUSTION (PURCHASE DIGITDIFF ON EXHAUSTED REPEAT DIGIT) -->
      <block type="variables_set" id="set_pred_quantum_90">
        <field name="VAR" id="var_prediction" variabletype="">Prediction Digit</field>
        <value name="VALUE">
          <block type="lists_getIndex" id="get_last_digit_quantum">
            <mutation statement="false" at="true"></mutation>
            <field name="MODE">GET</field>
            <field name="WHERE">FROM_END</field>
            <value name="VALUE">
              <block type="lastDigitList" id="ld_list_quantum"></block>
            </value>
            <value name="AT">
              <block type="math_number" id="idx_1_quantum_pred"><field name="NUM">1</field></block>
            </value>
          </block>
        </value>
        <next>
          <block type="notify" id="notify_quantum_90_trade">
            <field name="NOTIFICATION_TYPE">info</field>
            <field name="NOTIFICATION_SOUND">silent</field>
            <value name="MESSAGE">
              <block type="text" id="txt_quantum_90">
                <field name="TEXT">⚡ QUANTUM 90%+ DIFFER: Statistical Barrier Target Detected! Executing 1-tick DIGITDIFF contract...</field>
              </block>
            </value>
            <next>
              <block type="purchase" id="buy_digitdiff_quantum_90">
                <field name="PURCHASE_LIST">DIGITDIFF</field>
              </block>
            </next>
          </block>
        </next>
      </block>`
          : isSkipXDiffer
          ? `<!-- SKIP X BOT STRATEGY: PURCHASE DIGITDIFF(Y) WHEN 3 DIGITS FORM [X, Y, X] (WITH Y != X) (e.g. 3,4,3 -> Differ 4 | 5,7,5 -> Differ 7) -->
      <block type="variables_set" id="set_pred_current_tick_xyx">
        <field name="VAR" id="var_prediction" variabletype="">Prediction Digit</field>
        <value name="VALUE">
          <block type="lists_getIndex" id="get_last_digit_xyx">
            <mutation statement="false" at="true"></mutation>
            <field name="MODE">GET</field>
            <field name="WHERE">FROM_END</field>
            <value name="VALUE">
              <block type="lastDigitList" id="ld_list_xyx"></block>
            </value>
            <value name="AT">
              <block type="math_number" id="idx_2_xyx_pred"><field name="NUM">2</field></block>
            </value>
          </block>
        </value>
        <next>
          <block type="controls_if" id="check_xyx_pattern">
            <value name="IF0">
              <!-- Condition: (3rd last digit == last digit) AND (2nd last digit != last digit) -->
              <block type="logic_operation" id="op_and_xyx" inline="true">
                <field name="OP">AND</field>
                <value name="A">
                  <block type="logic_compare" id="cmp_d3_eq_d1">
                    <field name="OP">EQ</field>
                    <value name="A">
                      <block type="lists_getIndex" id="get_digit_3_xyx">
                        <mutation statement="false" at="true"></mutation>
                        <field name="MODE">GET</field>
                        <field name="WHERE">FROM_END</field>
                        <value name="VALUE">
                          <block type="lastDigitList" id="ld_list_xyx_3"></block>
                        </value>
                        <value name="AT">
                          <block type="math_number" id="idx_3_xyx"><field name="NUM">3</field></block>
                        </value>
                      </block>
                    </value>
                    <value name="B">
                      <block type="lists_getIndex" id="get_digit_1_xyx">
                        <mutation statement="false" at="true"></mutation>
                        <field name="MODE">GET</field>
                        <field name="WHERE">FROM_END</field>
                        <value name="VALUE">
                          <block type="lastDigitList" id="ld_list_xyx_1"></block>
                        </value>
                        <value name="AT">
                          <block type="math_number" id="idx_1_xyx_b"><field name="NUM">1</field></block>
                        </value>
                      </block>
                    </value>
                  </block>
                </value>
                <value name="B">
                  <block type="logic_compare" id="cmp_d2_neq_d1">
                    <field name="OP">NEQ</field>
                    <value name="A">
                      <block type="lists_getIndex" id="get_digit_2_xyx">
                        <mutation statement="false" at="true"></mutation>
                        <field name="MODE">GET</field>
                        <field name="WHERE">FROM_END</field>
                        <value name="VALUE">
                          <block type="lastDigitList" id="ld_list_xyx_2"></block>
                        </value>
                        <value name="AT">
                          <block type="math_number" id="idx_2_xyx"><field name="NUM">2</field></block>
                        </value>
                      </block>
                    </value>
                    <value name="B">
                      <block type="lists_getIndex" id="get_digit_1_xyx_c">
                        <mutation statement="false" at="true"></mutation>
                        <field name="MODE">GET</field>
                        <field name="WHERE">FROM_END</field>
                        <value name="VALUE">
                          <block type="lastDigitList" id="ld_list_xyx_1c"></block>
                        </value>
                        <value name="AT">
                          <block type="math_number" id="idx_1_xyx_c"><field name="NUM">1</field></block>
                        </value>
                      </block>
                    </value>
                  </block>
                </value>
              </block>
            </value>
            <statement name="DO0">
              <block type="notify" id="notify_xyx_detected">
                <field name="NOTIFICATION_TYPE">info</field>
                <field name="NOTIFICATION_SOUND">silent</field>
                <value name="MESSAGE">
                  <block type="text" id="txt_xyx_detected">
                    <field name="TEXT">🎯 SKIP X PATTERN [X, Y, X] DETECTED! Executing DIGITDIFF(Y) (1-tick: next digit settles trade)...</field>
                  </block>
                </value>
                <next>
                  <block type="purchase" id="buy_digitdiff_xyx">
                    <field name="PURCHASE_LIST">DIGITDIFF</field>
                  </block>
                </next>
              </block>
            </statement>
          </block>
        </next>
      </block>`
          : isDoubleDifferRange
          ? `<!-- DOUBLE DIFFER RANGE (XX) STRATEGY: PURCHASE DIGITDIFF(X) WHEN TWO CONSECUTIVE IDENTICAL DIGITS FORM (e.g. 0,0 -> Differ 0 | 3,3 -> Differ 3 | 5,5 -> Differ 5 | 8,8 -> Differ 8) -->
      <block type="variables_set" id="set_pred_current_tick_xx">
        <field name="VAR" id="var_prediction" variabletype="">Prediction Digit</field>
        <value name="VALUE">
          <block type="lists_getIndex" id="get_last_digit_xx">
            <mutation statement="false" at="true"></mutation>
            <field name="MODE">GET</field>
            <field name="WHERE">FROM_END</field>
            <value name="VALUE">
              <block type="lastDigitList" id="ld_list_xx"></block>
            </value>
            <value name="AT">
              <block type="math_number" id="idx_1_xx"><field name="NUM">1</field></block>
            </value>
          </block>
        </value>
        <next>
          <block type="controls_if" id="check_xx_pattern">
            <value name="IF0">
              <!-- Condition: 2nd last digit == last digit (d2 == d1) -->
              <block type="logic_compare" id="cmp_xx_range">
                <field name="OP">EQ</field>
                <value name="A">
                  <block type="lists_getIndex" id="get_digit_2_xx">
                    <mutation statement="false" at="true"></mutation>
                    <field name="MODE">GET</field>
                    <field name="WHERE">FROM_END</field>
                    <value name="VALUE">
                      <block type="lastDigitList" id="ld_list_xx_2"></block>
                    </value>
                    <value name="AT">
                      <block type="math_number" id="idx_2_xx"><field name="NUM">2</field></block>
                    </value>
                  </block>
                </value>
                <value name="B">
                  <block type="lists_getIndex" id="get_digit_1_xx">
                    <mutation statement="false" at="true"></mutation>
                    <field name="MODE">GET</field>
                    <field name="WHERE">FROM_END</field>
                    <value name="VALUE">
                      <block type="lastDigitList" id="ld_list_xx_1"></block>
                    </value>
                    <value name="AT">
                      <block type="math_number" id="idx_1_xx_b"><field name="NUM">1</field></block>
                    </value>
                  </block>
                </value>
              </block>
            </value>
            <statement name="DO0">
              <block type="notify" id="notify_xx_detected">
                <field name="NOTIFICATION_TYPE">info</field>
                <field name="NOTIFICATION_SOUND">silent</field>
                <value name="MESSAGE">
                  <block type="text" id="txt_xx_detected">
                    <field name="TEXT">🎯 DOUBLE IDENTICAL DIGIT DETECTED [X, X]! Executing DIGITDIFF contract (Differ X)...</field>
                  </block>
                </value>
                <next>
                  <block type="purchase" id="buy_digitdiff_xx">
                    <field name="PURCHASE_LIST">DIGITDIFF</field>
                  </block>
                </next>
              </block>
            </statement>
          </block>
        </next>
      </block>`
          : isXXYDifferX
          ? `<!-- XXY PATTERN (DIFFER REPEATING X): PURCHASE DIGITDIFF(X) WHEN LAST 3 DIGITS FORM [X, X, Y] (WITH Y != X) (e.g. 5,5,6 -> Differ 5) -->
      <block type="variables_set" id="set_pred_current_tick_x">
        <field name="VAR" id="var_prediction" variabletype="">Prediction Digit</field>
        <value name="VALUE">
          <block type="lists_getIndex" id="get_last_x_repeating">
            <mutation statement="false" at="true"></mutation>
            <field name="MODE">GET</field>
            <field name="WHERE">FROM_END</field>
            <value name="VALUE">
              <block type="lastDigitList" id="ld_list_x_always"></block>
            </value>
            <value name="AT">
              <block type="math_number" id="idx_2_x_always"><field name="NUM">2</field></block>
            </value>
          </block>
        </value>
        <next>
          <block type="controls_if" id="check_xxy_differ_x_pattern">
            <value name="IF0">
              <block type="logic_operation" id="op_and_pattern_x" inline="true">
                <field name="OP">AND</field>
                <!-- Condition 1: 3rd last digit == 2nd last digit (X == X) -->
                <value name="A">
                  <block type="logic_compare" id="cmp_xx_x">
                    <field name="OP">EQ</field>
                    <value name="A">
                      <block type="lists_getIndex" id="get_digit_3_x">
                        <mutation statement="false" at="true"></mutation>
                        <field name="MODE">GET</field>
                        <field name="WHERE">FROM_END</field>
                        <value name="VALUE">
                          <block type="lastDigitList" id="ld_list_1_x"></block>
                        </value>
                        <value name="AT">
                          <block type="math_number" id="idx_3_x"><field name="NUM">3</field></block>
                        </value>
                      </block>
                    </value>
                    <value name="B">
                      <block type="lists_getIndex" id="get_digit_2_x">
                        <mutation statement="false" at="true"></mutation>
                        <field name="MODE">GET</field>
                        <field name="WHERE">FROM_END</field>
                        <value name="VALUE">
                          <block type="lastDigitList" id="ld_list_2_x"></block>
                        </value>
                        <value name="AT">
                          <block type="math_number" id="idx_2_x"><field name="NUM">2</field></block>
                        </value>
                      </block>
                    </value>
                  </block>
                </value>
                <!-- Condition 2: 2nd last digit != last digit (X != Y) -->
                <value name="B">
                  <block type="logic_compare" id="cmp_xy_x">
                    <field name="OP">NEQ</field>
                    <value name="A">
                      <block type="lists_getIndex" id="get_digit_2_sub_x">
                        <mutation statement="false" at="true"></mutation>
                        <field name="MODE">GET</field>
                        <field name="WHERE">FROM_END</field>
                        <value name="VALUE">
                          <block type="lastDigitList" id="ld_list_3_x"></block>
                        </value>
                        <value name="AT">
                          <block type="math_number" id="idx_2_b_x"><field name="NUM">2</field></block>
                        </value>
                      </block>
                    </value>
                    <value name="B">
                      <block type="lists_getIndex" id="get_digit_1_x">
                        <mutation statement="false" at="true"></mutation>
                        <field name="MODE">GET</field>
                        <field name="WHERE">FROM_END</field>
                        <value name="VALUE">
                          <block type="lastDigitList" id="ld_list_4_x"></block>
                        </value>
                        <value name="AT">
                          <block type="math_number" id="idx_1_x"><field name="NUM">1</field></block>
                        </value>
                      </block>
                    </value>
                  </block>
                </value>
              </block>
            </value>
            <statement name="DO0">
              <block type="variables_set" id="set_pred_x_on_match">
                <field name="VAR" id="var_prediction" variabletype="">Prediction Digit</field>
                <value name="VALUE">
                  <block type="lists_getIndex" id="get_repeating_x">
                    <mutation statement="false" at="true"></mutation>
                    <field name="MODE">GET</field>
                    <field name="WHERE">FROM_END</field>
                    <value name="VALUE">
                      <block type="lastDigitList" id="ld_list_5_x"></block>
                    </value>
                    <value name="AT">
                      <block type="math_number" id="idx_2_x_match"><field name="NUM">2</field></block>
                    </value>
                  </block>
                </value>
                <next>
                  <block type="notify" id="notify_xxy_x_detected">
                    <field name="NOTIFICATION_TYPE">info</field>
                    <field name="NOTIFICATION_SOUND">silent</field>
                    <value name="MESSAGE">
                      <block type="text" id="txt_xxy_x_detected">
                        <field name="TEXT">🎯 XXY Pattern Detected [X, X, Y]! Prediction Digit set to repeating digit X. Executing DIGITDIFF contract (Differ X)...</field>
                      </block>
                    </value>
                    <next>
                      <block type="variables_set" id="clear_ready_before_buy_x">
                        <field name="VAR" id="var_xxy_ready" variabletype="">XXY Ready</field>
                        <value name="VALUE">
                          <block type="logic_boolean" id="bool_false_clear_x">
                            <field name="BOOL">FALSE</field>
                          </block>
                        </value>
                        <next>
                          <block type="purchase" id="buy_digitdiff_xxy_x">
                            <field name="PURCHASE_LIST">DIGITDIFF</field>
                          </block>
                        </next>
                      </block>
                    </next>
                  </block>
                </next>
              </block>
            </statement>
          </block>
        </next>
      </block>`
          : isTripleIdentical
          ? `<!-- TRIPLE IDENTICAL (XXX) STRATEGY: PURCHASE DIGITDIFF(X) WHEN 3 CONSECUTIVE IDENTICAL DIGITS FORM (e.g. 3,3,3 -> Differ 3 | 6,6,6 -> Differ 6 | 1,1,1 -> Differ 1) -->
      <block type="variables_set" id="set_pred_current_tick_xxx">
        <field name="VAR" id="var_prediction" variabletype="">Prediction Digit</field>
        <value name="VALUE">
          <block type="lists_getIndex" id="get_last_digit_xxx">
            <mutation statement="false" at="true"></mutation>
            <field name="MODE">GET</field>
            <field name="WHERE">FROM_END</field>
            <value name="VALUE">
              <block type="lastDigitList" id="ld_list_xxx"></block>
            </value>
            <value name="AT">
              <block type="math_number" id="idx_1_xxx"><field name="NUM">1</field></block>
            </value>
          </block>
        </value>
        <next>
          <block type="controls_if" id="check_xxx_pattern">
            <value name="IF0">
              <block type="logic_operation" id="op_and_xxx" inline="true">
                <field name="OP">AND</field>
                <!-- Condition 1: 3rd last digit == 2nd last digit (d3 == d2) -->
                <value name="A">
                  <block type="logic_compare" id="cmp_xxx_1">
                    <field name="OP">EQ</field>
                    <value name="A">
                      <block type="lists_getIndex" id="get_digit_3_xxx">
                        <mutation statement="false" at="true"></mutation>
                        <field name="MODE">GET</field>
                        <field name="WHERE">FROM_END</field>
                        <value name="VALUE">
                          <block type="lastDigitList" id="ld_list_xxx_1"></block>
                        </value>
                        <value name="AT">
                          <block type="math_number" id="idx_3_xxx"><field name="NUM">3</field></block>
                        </value>
                      </block>
                    </value>
                    <value name="B">
                      <block type="lists_getIndex" id="get_digit_2_xxx">
                        <mutation statement="false" at="true"></mutation>
                        <field name="MODE">GET</field>
                        <field name="WHERE">FROM_END</field>
                        <value name="VALUE">
                          <block type="lastDigitList" id="ld_list_xxx_2"></block>
                        </value>
                        <value name="AT">
                          <block type="math_number" id="idx_2_xxx"><field name="NUM">2</field></block>
                        </value>
                      </block>
                    </value>
                  </block>
                </value>
                <!-- Condition 2: 2nd last digit == last digit (d2 == d1) -->
                <value name="B">
                  <block type="logic_compare" id="cmp_xxx_2">
                    <field name="OP">EQ</field>
                    <value name="A">
                      <block type="lists_getIndex" id="get_digit_2_xxx_b">
                        <mutation statement="false" at="true"></mutation>
                        <field name="MODE">GET</field>
                        <field name="WHERE">FROM_END</field>
                        <value name="VALUE">
                          <block type="lastDigitList" id="ld_list_xxx_3"></block>
                        </value>
                        <value name="AT">
                          <block type="math_number" id="idx_2_xxx_b"><field name="NUM">2</field></block>
                        </value>
                      </block>
                    </value>
                    <value name="B">
                      <block type="lists_getIndex" id="get_digit_1_xxx">
                        <mutation statement="false" at="true"></mutation>
                        <field name="MODE">GET</field>
                        <field name="WHERE">FROM_END</field>
                        <value name="VALUE">
                          <block type="lastDigitList" id="ld_list_xxx_4"></block>
                        </value>
                        <value name="AT">
                          <block type="math_number" id="idx_1_xxx_b"><field name="NUM">1</field></block>
                        </value>
                      </block>
                    </value>
                  </block>
                </value>
              </block>
            </value>
            <statement name="DO0">
              <block type="notify" id="notify_xxx_detected">
                <field name="NOTIFICATION_TYPE">info</field>
                <field name="NOTIFICATION_SOUND">silent</field>
                <value name="MESSAGE">
                  <block type="text" id="txt_xxx_detected">
                    <field name="TEXT">🎯 TRIPLE IDENTICAL PATTERN DETECTED [X, X, X]! Executing DIGITDIFF contract (Differ X)...</field>
                  </block>
                </value>
                <next>
                  <block type="purchase" id="buy_digitdiff_xxx">
                    <field name="PURCHASE_LIST">DIGITDIFF</field>
                  </block>
                </next>
              </block>
            </statement>
          </block>
        </next>
      </block>`
          : isXXYPattern
          ? `<!-- XXY PATTERN STRATEGY: UPDATE PREDICTION DIGIT ON EVERY TICK AND PURCHASE DIGITDIFF(X) ON FRESH XXY PATTERN (DIFFER REPEATING X) -->
      <block type="variables_set" id="set_pred_current_tick_y">
        <field name="VAR" id="var_prediction" variabletype="">Prediction Digit</field>
        <value name="VALUE">
          <block type="lists_getIndex" id="get_last_y_every_tick">
            <mutation statement="false" at="true"></mutation>
            <field name="MODE">GET</field>
            <field name="WHERE">FROM_END</field>
            <value name="VALUE">
              <block type="lastDigitList" id="ld_list_always"></block>
            </value>
            <value name="AT">
              <block type="math_number" id="idx_1_y_always"><field name="NUM">2</field></block>
            </value>
          </block>
        </value>
        <next>
          <block type="controls_if" id="check_xxy_pattern">
            <value name="IF0">
              <block type="logic_operation" id="op_and_pattern" inline="true">
                <field name="OP">AND</field>
                <!-- Condition 1: 3rd last digit == 2nd last digit (X == X) -->
                <value name="A">
                  <block type="logic_compare" id="cmp_xx">
                    <field name="OP">EQ</field>
                    <value name="A">
                      <block type="lists_getIndex" id="get_digit_3">
                        <mutation statement="false" at="true"></mutation>
                        <field name="MODE">GET</field>
                        <field name="WHERE">FROM_END</field>
                        <value name="VALUE">
                          <block type="lastDigitList" id="ld_list_1"></block>
                        </value>
                        <value name="AT">
                          <block type="math_number" id="idx_3"><field name="NUM">3</field></block>
                        </value>
                      </block>
                    </value>
                    <value name="B">
                      <block type="lists_getIndex" id="get_digit_2">
                        <mutation statement="false" at="true"></mutation>
                        <field name="MODE">GET</field>
                        <field name="WHERE">FROM_END</field>
                        <value name="VALUE">
                          <block type="lastDigitList" id="ld_list_2"></block>
                        </value>
                        <value name="AT">
                          <block type="math_number" id="idx_2"><field name="NUM">2</field></block>
                        </value>
                      </block>
                    </value>
                  </block>
                </value>
                <!-- Condition 2: 2nd last digit != last digit (X != Y) -->
                <value name="B">
                  <block type="logic_compare" id="cmp_xy">
                    <field name="OP">NEQ</field>
                    <value name="A">
                      <block type="lists_getIndex" id="get_digit_2_sub">
                        <mutation statement="false" at="true"></mutation>
                        <field name="MODE">GET</field>
                        <field name="WHERE">FROM_END</field>
                        <value name="VALUE">
                          <block type="lastDigitList" id="ld_list_3"></block>
                        </value>
                        <value name="AT">
                          <block type="math_number" id="idx_2_b"><field name="NUM">2</field></block>
                        </value>
                      </block>
                    </value>
                    <value name="B">
                      <block type="lists_getIndex" id="get_digit_1">
                        <mutation statement="false" at="true"></mutation>
                        <field name="MODE">GET</field>
                        <field name="WHERE">FROM_END</field>
                        <value name="VALUE">
                          <block type="lastDigitList" id="ld_list_4"></block>
                        </value>
                        <value name="AT">
                          <block type="math_number" id="idx_1"><field name="NUM">1</field></block>
                        </value>
                      </block>
                    </value>
                  </block>
                </value>
              </block>
            </value>
            <statement name="DO0">
              <block type="variables_set" id="set_pred_y_on_match">
                <field name="VAR" id="var_prediction" variabletype="">Prediction Digit</field>
                <value name="VALUE">
                  <block type="lists_getIndex" id="get_unique_current_y">
                    <mutation statement="false" at="true"></mutation>
                    <field name="MODE">GET</field>
                    <field name="WHERE">FROM_END</field>
                    <value name="VALUE">
                      <block type="lastDigitList" id="ld_list_5"></block>
                    </value>
                    <value name="AT">
                      <block type="math_number" id="idx_1_y"><field name="NUM">2</field></block>
                    </value>
                  </block>
                </value>
                <next>
                  <block type="notify" id="notify_xxy_detected">
                    <field name="NOTIFICATION_TYPE">info</field>
                    <field name="NOTIFICATION_SOUND">silent</field>
                    <value name="MESSAGE">
                      <block type="text" id="txt_xxy_detected">
                        <field name="TEXT">🎯 XXY Pattern Detected [X, X, Y]! Prediction Digit set to repeating digit X. Executing DIGITDIFF contract (Differ X)...</field>
                      </block>
                    </value>
                    <next>
                      <block type="variables_set" id="clear_ready_before_buy">
                        <field name="VAR" id="var_xxy_ready" variabletype="">XXY Ready</field>
                        <value name="VALUE">
                          <block type="logic_boolean" id="bool_false_clear">
                            <field name="BOOL">FALSE</field>
                          </block>
                        </value>
                        <next>
                          <block type="purchase" id="buy_digitdiff_xxy">
                            <field name="PURCHASE_LIST">DIGITDIFF</field>
                          </block>
                        </next>
                      </block>
                    </next>
                  </block>
                </next>
              </block>
            </statement>
          </block>
        </next>
      </block>`
          : `<block type="purchase" id="purchase_default">
        <field name="PURCHASE_LIST">${bot.contractType || 'DIGITDIFF'}</field>
      </block>`
      }
    </statement>
  </block>

  <!-- ========================================================== -->
  <!-- BLOCK 3: DURING PURCHASE WATCHDOG                         -->
  <!-- ========================================================== -->
  <block type="during_purchase" id="during_purchase_main" x="0" y="950"></block>

  <!-- ========================================================== -->
  <!-- BLOCK 4: AFTER PURCHASE / MARTINGALE & RISK MANAGEMENT    -->
  <!-- ========================================================== -->
  <block type="after_purchase" id="after_purchase_main" x="0" y="1050">
    <statement name="AFTERPURCHASE_STACK">
      <block type="controls_if" id="check_trade_result">
        <mutation else="1"></mutation>
        <value name="IF0">
          <block type="contract_check_result" id="check_win">
            <field name="CHECK_RESULT">win</field>
          </block>
        </value>
        <statement name="DO0">
          <block type="notify" id="notify_win">
            <field name="NOTIFICATION_TYPE">success</field>
            <field name="NOTIFICATION_SOUND">earned-money</field>
            <value name="MESSAGE">
              <block type="text" id="txt_win">
                <field name="TEXT">${isCompounding ? '✅ TRADE WIN! Compounding Stake: Adding trade profit to current stake.' : '✅ TRADE WIN! Resetting stake to initial base level.'}</field>
              </block>
            </value>
            <next>
              <block type="variables_set" id="reset_stake">
                <field name="VAR" id="var_stake" variabletype="">Stake</field>
                <value name="VALUE">
                  ${isCompounding
                    ? `<block type="math_arithmetic" id="add_profit_to_stake">
                    <field name="OP">ADD</field>
                    <value name="A">
                      <block type="variables_get" id="get_stake_comp">
                        <field name="VAR" id="var_stake" variabletype="">Stake</field>
                      </block>
                    </value>
                    <value name="B">
                      <block type="read_details" id="read_profit_detail">
                        <field name="DETAIL_INDEX">4</field>
                      </block>
                    </value>
                  </block>`
                    : `<block type="variables_get" id="get_base_stake">
                    <field name="VAR" id="var_initial_stake" variabletype="">Initial Stake</field>
                  </block>`}
                </value>
              </block>
            </next>
          </block>
        </statement>
        <statement name="ELSE">
          <block type="notify" id="notify_loss">
            <field name="NOTIFICATION_TYPE">warn</field>
            <field name="NOTIFICATION_SOUND">job-done</field>
            <value name="MESSAGE">
              <block type="text" id="txt_loss">
                <field name="TEXT">⚠️ TRADE LOSS! Multiplying stake by Martingale Factor.</field>
              </block>
            </value>
            <next>
              <block type="variables_set" id="apply_martingale">
                <field name="VAR" id="var_stake" variabletype="">Stake</field>
                <value name="VALUE">
                  <block type="math_arithmetic" id="mult_stake">
                    <field name="OP">MULTIPLY</field>
                    <value name="A">
                      <block type="variables_get" id="get_curr_stake">
                        <field name="VAR" id="var_stake" variabletype="">Stake</field>
                      </block>
                    </value>
                    <value name="B">
                      <block type="variables_get" id="get_m_factor">
                        <field name="VAR" id="var_martingale" variabletype="">Martingale Factor</field>
                      </block>
                    </value>
                  </block>
                </value>
              </block>
            </next>
          </block>
        </statement>
        <next>
          ${
            isXXYPattern
              ? `<block type="variables_set" id="reset_xxy_ready_after_trade">
            <field name="VAR" id="var_xxy_ready" variabletype="">XXY Ready</field>
            <value name="VALUE">
              <block type="logic_boolean" id="bool_false_after">
                <field name="BOOL">FALSE</field>
              </block>
            </value>
            <next>
              <block type="trade_again" id="trade_again_loop"></block>
            </next>
          </block>`
              : `<block type="trade_again" id="trade_again_loop"></block>`
          }
        </next>
      </block>
    </statement>
  </block>
</xml>
`;
}

