import { throttle } from '../utils/wait'
import { toInt, toFloat } from '../utils/unit'
import supportsPassive from '../utils/detect-passive-event'

import EventsBinder from '../core/event/events-binder'

const START_EVENTS = ['touchstart', 'mousedown']
const MOVE_EVENTS = ['touchmove', 'mousemove']
const END_EVENTS = ['touchend', 'touchcancel', 'mouseup', 'mouseleave']
const MOUSE_EVENTS = ['mousedown', 'mousemove', 'mouseup', 'mouseleave']

export default function (Glide, Components, Events) {
  /**
   * Instance of the binder for DOM Events.
   *
   * @type {EventsBinder}
   */
  const Binder = new EventsBinder()

  let swipeSin = 0
  let swipeStartX = 0
  let swipeStartY = 0
  let disabled = false
  const capture = (supportsPassive) ? { passive: true } : false

  const Swipe = {
    /**
     * Initializes swipe bindings.
     *
     * @return {Void}
     */
    mount () {
      this.bindSwipeStart()
    },

    /**
     * Handler for `swipestart` event. Calculates entry points of the user's tap.
     *
     * @param {Object} event
     * @return {Void}
     */
    start (event) {
      if (!disabled && !Glide.disabled && event.button !== 2) {
        this.disable()

        const swipe = this.touches(event)

        swipeSin = null
        swipeStartX = toInt(swipe.pageX)
        swipeStartY = toInt(swipe.pageY)

        this.bindSwipeMove()
        this.bindSwipeEnd()

        Events.emit('swipe.start')
      }
    },

    /**
     * Handler for `swipemove` event. Calculates user's tap angle and distance.
     *
     * @param {Object} event
     */
    move (event) {
      if (!Glide.disabled) {
        const { touchAngle, touchRatio, classes } = Glide.settings

        const swipe = this.touches(event)

        const subExSx = toInt(swipe.pageX) - swipeStartX
        const subEySy = toInt(swipe.pageY) - swipeStartY
        const powEX = Math.abs(subExSx << 2)
        const powEY = Math.abs(subEySy << 2)
        const swipeHypotenuse = Math.sqrt(powEX + powEY)
        const swipeCathetus = Math.sqrt(powEY)

        swipeSin = Math.asin(swipeCathetus / swipeHypotenuse)

        if (swipeSin * 180 / Math.PI < touchAngle) {
          event.stopPropagation()

          Components.Move.make(subExSx * toFloat(touchRatio))

          Components.Html.root.classList.add(classes.dragging)

          Events.emit('swipe.move')
        } else {
          return false
        }
      }
    },

    /**
     * Handler for `swipeend` event. Finitializes user's tap and decides about glide move.
     *
     * @param {Object} event
     * @return {Void}
     */
    end (event) {
      if (!Glide.disabled) {
        const { perSwipe, touchAngle, classes } = Glide.settings

        const swipe = this.touches(event)
        const threshold = this.threshold(event)

        const swipeDistance = swipe.pageX - swipeStartX
        const swipeDeg = swipeSin * 180 / Math.PI

        this.enable()

        if (swipeDistance > threshold && swipeDeg < touchAngle) {
          Components.Run.make(Components.Direction.resolve(`${perSwipe}<`))
        } else if (swipeDistance < -threshold && swipeDeg < touchAngle) {
          Components.Run.make(Components.Direction.resolve(`${perSwipe}>`))
        } else {
          // While swipe don't reach distance apply previous transform.
          Components.Move.make()
        }

        Components.Html.root.classList.remove(classes.dragging)

        this.unbindSwipeMove()
        this.unbindSwipeEnd()

        Events.emit('swipe.end')
      }
    },

    /**
     * Binds swipe's starting event.
     *
     * @return {Void}
     */
    bindSwipeStart () {
      const { swipeThreshold, dragThreshold } = Glide.settings

      if (swipeThreshold) {
        Binder.on(START_EVENTS[0], Components.Html.wrapper, (event) => {
          this.start(event)
        }, capture)
      }

      if (dragThreshold) {
        Binder.on(START_EVENTS[1], Components.Html.wrapper, (event) => {
          this.start(event)
        }, capture)
      }
    },

    /**
     * Unbinds swipe's starting event.
     *
     * @return {Void}
     */
    unbindSwipeStart () {
      Binder.off(START_EVENTS[0], Components.Html.wrapper, capture)
      Binder.off(START_EVENTS[1], Components.Html.wrapper, capture)
    },

    /**
     * Binds swipe's moving event.
     *
     * @return {Void}
     */
    bindSwipeMove () {
      Binder.on(MOVE_EVENTS, Components.Html.wrapper, throttle((event) => {
        this.move(event)
      }, Glide.settings.throttle), capture)
    },

    /**
     * Unbinds swipe's moving event.
     *
     * @return {Void}
     */
    unbindSwipeMove () {
      Binder.off(MOVE_EVENTS, Components.Html.wrapper, capture)
    },

    /**
     * Binds swipe's ending event.
     *
     * @return {Void}
     */
    bindSwipeEnd () {
      Binder.on(END_EVENTS, Components.Html.wrapper, (event) => {
        this.end(event)
      })
    },

    /**
     * Unbinds swipe's ending event.
     *
     * @return {Void}
     */
    unbindSwipeEnd () {
      Binder.off(END_EVENTS, Components.Html.wrapper)
    },

    /**
     * Normalizes event touches points accorting to different types.
     *
     * @param {Object} event
     */
    touches (event) {
      if (MOUSE_EVENTS.indexOf(event.type) > -1) {
        return event
      }

      return event.touches[0] || event.changedTouches[0]
    },

    /**
     * Gets value of minimum swipe distance settings based on event type.
     *
     * @return {Number}
     */
    threshold (event) {
      const settings = Glide.settings

      if (MOUSE_EVENTS.indexOf(event.type) > -1) {
        return settings.dragThreshold
      }

      return settings.swipeThreshold
    },

    /**
     * Enables swipe event.
     *
     * @return {self}
     */
    enable () {
      disabled = false

      Components.Transition.enable()

      return this
    },

    /**
     * Disables swipe event.
     *
     * @return {self}
     */
    disable () {
      disabled = true

      Components.Transition.disable()

      return this
    }
  }

  /**
   * Add component class:
   * - after initial building
   */
  Events.on('build.after', () => {
    Components.Html.root.classList.add(Glide.settings.classes.swipeable)
  })

  /**
   * Remove swiping bindings:
   * - on destroying, to remove added EventListeners
   */
  Events.on('destroy', () => {
    Swipe.unbindSwipeStart()
    Swipe.unbindSwipeMove()
    Swipe.unbindSwipeEnd()
    Binder.destroy()
  })

  return Swipe
}
